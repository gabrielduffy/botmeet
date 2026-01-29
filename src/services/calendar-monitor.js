// src/services/calendar-monitor.js
// Monitora o Google Calendar e detecta reuniões com Google Meet

const { google } = require('googleapis');
const { logger } = require('../utils/logger');

class CalendarMonitor {
  constructor() {
    this.calendar = null;
    this.oauth2Client = null;
  }

  /**
   * Inicializa conexão com Google Calendar API
   */
  async initialize() {
    logger.info('[Calendar] Inicializando...');

    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'http://localhost:3000/oauth/callback'
    );

    this.oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });

    // Configurar refresh automático de token
    this.oauth2Client.on('tokens', (tokens) => {
      if (tokens.refresh_token) {
        logger.info('[Calendar] Novo refresh token recebido');
      }
      logger.info('[Calendar] Token atualizado');
    });

    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

    // Testar conexão
    await this.testConnection();

    logger.info('[Calendar] ✅ Inicializado com sucesso');
  }

  /**
   * Testa conexão com a API
   */
  async testConnection() {
    try {
      const response = await this.calendar.calendarList.list({
        maxResults: 1,
      });
      logger.info(`[Calendar] Conexão OK - ${response.data.items?.length || 0} calendários`);
      return true;
    } catch (error) {
      logger.error(`[Calendar] Erro de conexão: ${error.message}`);
      throw error;
    }
  }

  /**
   * Busca reuniões nos próximos X minutos
   * @param {number} minutesAhead - Quantos minutos à frente buscar
   * @returns {Array} Lista de reuniões com Google Meet
   */
  async getUpcomingMeetings(minutesAhead = 10) {
    const now = new Date();
    const later = new Date(now.getTime() + minutesAhead * 60 * 1000);

    try {
      const response = await this.calendar.events.list({
        calendarId: 'primary',
        timeMin: now.toISOString(),
        timeMax: later.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = response.data.items || [];

      // Filtrar apenas eventos com Google Meet
      const meetingsWithMeet = events
        .filter(event => this.extractMeetUrl(event))
        .map(event => ({
          id: event.id,
          summary: event.summary || 'Sem título',
          description: event.description || '',
          start: event.start?.dateTime || event.start?.date,
          end: event.end?.dateTime || event.end?.date,
          meetUrl: this.extractMeetUrl(event),
          attendees: event.attendees?.map(a => a.email) || [],
          organizer: event.organizer?.email,
          htmlLink: event.htmlLink,
        }));

      logger.info(`[Calendar] Encontrados ${meetingsWithMeet.length} eventos com Meet de ${events.length} total`);

      return meetingsWithMeet;
    } catch (error) {
      logger.error(`[Calendar] Erro ao buscar eventos: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extrai URL do Google Meet de um evento
   */
  extractMeetUrl(event) {
    // Método 1: conferenceData (forma oficial)
    if (event.conferenceData?.entryPoints) {
      const videoEntry = event.conferenceData.entryPoints.find(
        ep => ep.entryPointType === 'video'
      );
      if (videoEntry?.uri) {
        return videoEntry.uri;
      }
    }

    // Método 2: hangoutLink
    if (event.hangoutLink) {
      return event.hangoutLink;
    }

    // Método 3: procurar no campo location
    if (event.location && event.location.includes('meet.google.com')) {
      const match = event.location.match(/https:\/\/meet\.google\.com\/[a-z-]+/i);
      if (match) return match[0];
    }

    // Método 4: procurar na descrição
    if (event.description) {
      const match = event.description.match(/https:\/\/meet\.google\.com\/[a-z-]+/i);
      if (match) return match[0];
    }

    return null;
  }

  /**
   * Busca um evento específico pelo ID
   */
  async getEvent(eventId) {
    try {
      const response = await this.calendar.events.get({
        calendarId: 'primary',
        eventId: eventId,
      });

      const event = response.data;

      return {
        id: event.id,
        summary: event.summary || 'Sem título',
        description: event.description || '',
        start: event.start?.dateTime || event.start?.date,
        end: event.end?.dateTime || event.end?.date,
        meetUrl: this.extractMeetUrl(event),
        attendees: event.attendees?.map(a => a.email) || [],
        organizer: event.organizer?.email,
      };
    } catch (error) {
      logger.error(`[Calendar] Erro ao buscar evento ${eventId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Lista todos os calendários da conta
   */
  async listCalendars() {
    try {
      const response = await this.calendar.calendarList.list();
      return response.data.items || [];
    } catch (error) {
      logger.error(`[Calendar] Erro ao listar calendários: ${error.message}`);
      throw error;
    }
  }
}

module.exports = { CalendarMonitor };
