import logging
import os
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from shared_models.models import Meeting

logger = logging.getLogger(__name__)

async def run(meeting: Meeting, db: AsyncSession):
    """
    Fetches transcription data from the transcription-collector service,
    aggregates participant and language information, and updates the meeting record.
    """
    meeting_id = meeting.id
    logger.info(f"Starting transcription aggregation for meeting {meeting_id}")

    try:
        # Use environment variable for URL, with fallback for docker-compose (separate containers)
        # In docker lite setup, this should be set to http://localhost:8123
        collector_base_url = os.getenv(
            "TRANSCRIPTION_COLLECTOR_URL", 
            "http://transcription-collector:8000"  # Fallback for docker-compose setup
        )
        collector_url = f"{collector_base_url}/internal/transcripts/{meeting_id}"
        
        async with httpx.AsyncClient() as client:
            logger.info(f"Calling transcription-collector for meeting {meeting_id} at {collector_url}")
            response = await client.get(collector_url, timeout=30.0) # Increased timeout
        
        if response.status_code == 200:
            transcription_segments = response.json()
            logger.info(f"Received {len(transcription_segments)} segments from collector for meeting {meeting_id}")
            
            if not transcription_segments:
                logger.info(f"No transcription segments returned for meeting {meeting_id}. Nothing to aggregate.")
                return

            unique_speakers = set()
            unique_languages = set()
            full_transcript_parts = []
            
            for segment in transcription_segments:
                speaker = segment.get('speaker', 'Unknown')
                text = segment.get('text', '').strip()
                language = segment.get('language')
                
                if speaker:
                    unique_speakers.add(speaker.strip())
                if language:
                    unique_languages.add(language.strip())
                
                if text:
                    full_transcript_parts.append(f"{speaker}: {text}")
            
            full_transcription = "\n".join(full_transcript_parts)
            
            aggregated_data = {}
            if unique_speakers:
                aggregated_data['participants'] = sorted(list(unique_speakers))
            if unique_languages:
                aggregated_data['languages'] = sorted(list(unique_languages))
            if full_transcription:
                aggregated_data['transcription'] = full_transcription
            
            if aggregated_data:
                # Use a flag to track if the data object was changed
                data_changed = False
                # Ensure meeting.data is a dictionary
                existing_data = meeting.data or {}
                
                # Update fields if not present
                for key, value in aggregated_data.items():
                    if key not in existing_data or (not existing_data[key] and value):
                        existing_data[key] = value
                        data_changed = True
                
                if data_changed:
                    meeting.data = existing_data
                    # The caller is responsible for the commit
                    logger.info(f"Auto-aggregated transcription data for meeting {meeting_id}")
                else:
                    logger.info(f"Data for 'participants' and 'languages' already exists in meeting {meeting_id}. No update performed.")

            else:
                logger.info(f"No new participants or languages to aggregate for meeting {meeting_id}")

        else:
            logger.error(f"Failed to get transcript from collector for meeting {meeting_id}. Status: {response.status_code}, Body: {response.text}")

    except httpx.RequestError as exc:
        logger.error(f"An error occurred while requesting transcript for meeting {meeting_id} from {exc.request.url!r}: {exc}", exc_info=True)
    except Exception as e:
        logger.error(f"Failed to process and aggregate data for meeting {meeting_id}: {e}", exc_info=True) 