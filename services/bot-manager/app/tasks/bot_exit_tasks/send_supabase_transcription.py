import logging
import httpx
import os
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from shared_models.models import Meeting

logger = logging.getLogger(__name__)

async def run(meeting: Meeting, db: AsyncSession):
    """
    Sends the meeting transcription to the Supabase Edge Function.
    """
    logger.info(f"Executing send_supabase_transcription task for meeting {meeting.id}")

    try:
        # 1. Get transcription from meeting data (loaded from transcription-collector)
        # meeting.data is expected to have 'full_transcription' or similar
        # Based on previous work, we might need to join segments
        transcription_text = meeting.data.get('transcription') if meeting.data else ""
        
        if not transcription_text:
            logger.warning(f"No transcription found for meeting {meeting.id}. Skipping Supabase webhook.")
            return

        # 2. Calculate duration
        duration = 0
        if meeting.start_time and meeting.end_time:
            duration = int((meeting.end_time - meeting.start_time).total_seconds())

        # 3. Get Auth and URL
        webhook_url = "https://kbtijxfscztjriinidqa.supabase.co/functions/v1/receive-transcription"
        api_key = os.getenv("N8N_API_KEY")

        if not api_key:
            logger.warning("N8N_API_KEY not found in environment variables.")
            # We will continue but it might fail if Supabase requires it

        # Prepare Payload conforme especificado
        payload = {
            "fileId": f"meet_{meeting.id}_{meeting.native_meeting_id}",
            "transcription": transcription_text,
            "duration": duration,
            "hangoutLink": meeting.constructed_meeting_url
        }

        # 5. Send to Supabase
        headers = {
            "Content-Type": "application/json",
            "x-api-key": os.getenv("N8N_API_KEY", "") # Usando a chave configurada
        }

        async with httpx.AsyncClient() as client:
            logger.info(f"Enviando transcrição direta para Supabase: {webhook_url}")
            response = await client.post(
                webhook_url,
                json=payload,
                headers=headers,
                timeout=60.0
            )
            
            if 200 <= response.status_code < 300:
                logger.info(f"Successfully sent transcription to Supabase for meeting {meeting.id}")
            else:
                logger.error(f"Supabase webhook failed with status {response.status_code}: {response.text}")

    except Exception as e:
        logger.error(f"Error in send_supabase_transcription for meeting {meeting.id}: {e}", exc_info=True)
