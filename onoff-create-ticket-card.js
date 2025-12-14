class OnOffCreateTicketCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.activeTab = 'create';
    this.selectedTicket = null;
    this.expandedTicket = false;
    this.contactsEntity = null;
    this._contacts = [];
  }

  setConfig(config) {
    this.config = config;
    this.ticketsEntity = config.tickets_entity || null; // Will auto-detect if null
    this.contactsEntity = config.contacts_entity || null; // Will auto-detect if null
    this.showReplyTab = config.show_reply_tab !== false; // Default to true unless explicitly set to false
  }

  set hass(hass) {
    const oldHass = this._hass;
    this._hass = hass;
    if (!this.rendered) {
      this.render();
      this.rendered = true;
    } else if (oldHass !== hass) {
      // Reload tickets and contacts when hass updates
      this.loadTickets();
      this.loadContacts();
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        ha-card {
          padding: 16px;
          background: linear-gradient(135deg, #2C3E50 0%, #3498DB 100%);
          color: white;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .header {
          margin-bottom: 16px;
        }
        .header h2 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
        }
        .tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }
        .tab {
          flex: 1;
          padding: 10px;
          background: rgba(255,255,255,0.2);
          border: 2px solid rgba(255,255,255,0.3);
          border-radius: 6px;
          color: white;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          text-align: center;
        }
        .tab:hover {
          background: rgba(255,255,255,0.3);
        }
        .tab.active {
          background: rgba(255,255,255,0.4);
          border-color: white;
        }
        .tab-content {
          display: none;
        }
        .tab-content.active {
          display: block;
        }
        .form-group {
          margin-bottom: 12px;
        }
        label {
          display: block;
          font-weight: 600;
          margin-bottom: 6px;
          font-size: 14px;
        }
        input, textarea, select {
          width: 100%;
          padding: 10px;
          border: 2px solid rgba(255,255,255,0.3);
          border-radius: 6px;
          background: rgba(255,255,255,0.9);
          color: #333;
          font-size: 14px;
          box-sizing: border-box;
        }
        textarea {
          min-height: 100px;
          resize: vertical;
          font-family: inherit;
        }
        input:focus, textarea:focus, select:focus {
          outline: none;
          border-color: rgba(255,255,255,0.8);
          background: white;
        }
        .submit-btn {
          width: 100%;
          padding: 12px;
          background: rgba(255,255,255,0.25);
          border: 2px solid white;
          border-radius: 8px;
          color: white;
          font-weight: 600;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.3s;
          margin-top: 8px;
        }
        .submit-btn:hover {
          background: rgba(255,255,255,0.35);
          transform: translateY(-2px);
        }
        .submit-btn:active {
          transform: translateY(0);
        }
        .success-message {
          background: rgba(76, 175, 80, 0.9);
          padding: 12px;
          border-radius: 6px;
          margin-top: 12px;
          display: none;
        }
        .error-message {
          background: rgba(244, 67, 54, 0.9);
          padding: 12px;
          border-radius: 6px;
          margin-top: 12px;
          display: none;
        }
        .ticket-info {
          background: rgba(255,255,255,0.2);
          padding: 12px;
          border-radius: 6px;
          margin-bottom: 12px;
        }
        .ticket-info h3 {
          margin: 0 0 8px 0;
          font-size: 16px;
        }
        .last-note {
          background: rgba(255,255,255,0.15);
          padding: 10px;
          border-radius: 4px;
          margin-top: 8px;
          font-size: 13px;
          max-height: 60px;
          overflow: hidden;
        }
        .last-note.expanded {
          max-height: none;
        }
        .expand-btn {
          background: rgba(255,255,255,0.2);
          border: 1px solid rgba(255,255,255,0.4);
          color: white;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          margin-top: 8px;
          width: 100%;
        }
        .expand-btn:hover {
          background: rgba(255,255,255,0.3);
        }
        .ticket-details {
          background: rgba(255,255,255,0.15);
          padding: 12px;
          border-radius: 6px;
          margin-top: 8px;
          font-size: 13px;
          max-height: 200px;
          overflow-y: auto;
          display: none;
        }
        .ticket-details.visible {
          display: block;
        }
      </style>
      <ha-card>
        <div class="header">
          <h2>📝 Ticket Management</h2>
        </div>

        <div class="tabs">
          <button class="tab ${this.activeTab === 'create' ? 'active' : ''}" data-tab="create">
            Create Ticket
          </button>
          ${this.showReplyTab ? `
          <button class="tab ${this.activeTab === 'reply' ? 'active' : ''}" data-tab="reply">
            Reply to Ticket
          </button>
          ` : ''}
        </div>

        <!-- Create Ticket Tab -->
        <div class="tab-content ${this.activeTab === 'create' ? 'active' : ''}" id="create-tab">
          <form id="ticket-form">
            <div class="form-group">
              <label for="ticket-type">Ticket Type *</label>
              <select id="ticket-type" required>
                <option value="">Select Type</option>
                <option value="Feature Request">Feature Request</option>
                <option value="Need Support">Need Support</option>
                <option value="Bug">Bug</option>
                <option value="Addons">Addons</option>
                <option value="Issue">Issue</option>
              </select>
            </div>
            <div class="form-group">
              <label for="subject">Subject *</label>
              <input type="text" id="subject" required placeholder="Brief description of the issue">
            </div>
            <div class="form-group">
              <label for="details">Details *</label>
              <textarea id="details" required placeholder="Detailed description of the issue"></textarea>
            </div>
            <div class="form-group">
              <label for="priority">Priority</label>
              <select id="priority">
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
            <div class="form-group">
              <label for="email">Email</label>
              <input type="email" id="email" placeholder="your.email@example.com">
            </div>
            <div class="form-group">
              <label for="phone">Phone *</label>
              <input type="tel" id="phone" required placeholder="+1234567890">
            </div>
            <div class="form-group">
              <label for="contact-select">Contact (optional)</label>
              <select id="contact-select">
                <option value="">Default (HA API contact)</option>
              </select>
            </div>
            <button type="submit" class="submit-btn">Create Ticket</button>
            <div class="success-message" id="create-success-msg">✓ Ticket created successfully!</div>
            <div class="error-message" id="create-error-msg">✗ Failed to create ticket. Please try again.</div>
          </form>
        </div>

        <!-- Reply to Ticket Tab -->
        ${this.showReplyTab ? `
        <div class="tab-content ${this.activeTab === 'reply' ? 'active' : ''}" id="reply-tab">
          <form id="reply-form">
            <div class="form-group">
              <label for="ticket-search">Search Tickets</label>
              <input type="text" id="ticket-search" placeholder="Search by ticket number or subject...">
            </div>
            <div class="form-group">
              <label for="ticket-select">Select Ticket *</label>
              <select id="ticket-select" required size="8" style="min-height: 180px;">
                <option value="">Select a ticket...</option>
              </select>
            </div>

            <div class="ticket-info" id="ticket-info-box" style="display: none;">
              <h3 id="ticket-info-title">Ticket Details</h3>
              <div><strong>Status:</strong> <span id="ticket-status">-</span></div>
              <div><strong>Priority:</strong> <span id="ticket-priority">-</span></div>

              <div class="last-note" id="last-note">
                <strong>Last Note:</strong><br>
                <span id="last-note-text">No notes yet</span>
              </div>

              <button type="button" class="expand-btn" id="expand-ticket-btn">
                Show Full Ticket Details
              </button>

              <div class="ticket-details" id="ticket-details">
                <strong>Full Ticket History:</strong><br>
                <div id="ticket-history">Loading...</div>
              </div>
            </div>

            <div class="form-group">
              <label for="reply-text">Your Reply *</label>
              <textarea id="reply-text" required placeholder="Enter your reply..."></textarea>
            </div>

            <button type="submit" class="submit-btn">Send Reply</button>
            <div class="success-message" id="reply-success-msg">✓ Reply sent successfully!</div>
            <div class="error-message" id="reply-error-msg">✗ Failed to send reply. Please try again.</div>
          </form>
        </div>
        ` : ''}
      </ha-card>
    `;

    this.attachEventListeners();
    this.loadTickets();
    this.loadContacts();
  }

  attachEventListeners() {
    // Tab switching
    const tabs = this.shadowRoot.querySelectorAll('.tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this.activeTab = tab.dataset.tab;
        this.render();
        // Load tickets and contacts when switching to reply tab
        if (this.activeTab === 'reply') {
          setTimeout(() => {
            this.loadTickets();
            this.loadContacts();
          }, 100);
        }
      });
    });

    // Create ticket form
    const createForm = this.shadowRoot.getElementById('ticket-form');
    if (createForm) {
      createForm.addEventListener('submit', (e) => this.handleCreateTicket(e));
    }

    // Reply form
    const replyForm = this.shadowRoot.getElementById('reply-form');
    if (replyForm) {
      replyForm.addEventListener('submit', (e) => this.handleReplyTicket(e));
    }

    // Ticket search
    const ticketSearch = this.shadowRoot.getElementById('ticket-search');
    if (ticketSearch) {
      ticketSearch.addEventListener('input', (e) => {
        this.loadTickets(e.target.value);
      });
    }

    // Ticket selection
    const ticketSelect = this.shadowRoot.getElementById('ticket-select');
    if (ticketSelect) {
      ticketSelect.addEventListener('change', (e) => this.handleTicketSelect(e));
    }

    // Expand ticket button
    const expandBtn = this.shadowRoot.getElementById('expand-ticket-btn');
    if (expandBtn) {
      expandBtn.addEventListener('click', () => this.toggleTicketDetails());
    }
  }

  loadTickets(searchTerm = '') {
    if (!this._hass) {
      console.log('loadTickets: hass not available yet');
      return;
    }

    const ticketSelect = this.shadowRoot.getElementById('ticket-select');
    if (!ticketSelect) {
      console.log('loadTickets: ticket-select element not found');
      return;
    }

    // Try to find the tickets entity
    let entity = this._hass.states[this.ticketsEntity];

    // If not found, search for it
    if (!entity) {
      console.log('loadTickets: searching for open_tickets entity...');
      for (const entity_id in this._hass.states) {
        if (entity_id.includes('open_tickets') && entity_id.startsWith('sensor.')) {
          entity = this._hass.states[entity_id];
          this.ticketsEntity = entity_id;
          console.log('loadTickets: found entity:', entity_id);
          break;
        }
      }
    }

    if (!entity) {
      console.log('loadTickets: no open_tickets entity found');
      return;
    }

    const tickets = entity && entity.attributes && entity.attributes.tickets ? entity.attributes.tickets : [];
    console.log('loadTickets: found', tickets.length, 'tickets');

    // Filter tickets based on search term
    const filteredTickets = searchTerm ? tickets.filter(ticket => {
      const ticketNum = String(ticket.number || ticket.ticket_number || ticket.id || '');
      const ticketSubject = String(ticket.subject || ticket.ticket_subject || '').toLowerCase();
      const search = searchTerm.toLowerCase();
      return ticketNum.includes(search) || ticketSubject.includes(search);
    }) : tickets;

    // Clear existing options except first
    ticketSelect.innerHTML = '<option value="">Select a ticket...</option>';

    // Add filtered tickets to dropdown
    filteredTickets.forEach(ticket => {
      const option = document.createElement('option');
      option.value = JSON.stringify(ticket);
      option.textContent = `#${ticket.number || ticket.ticket_number || ticket.id || '?'} - ${ticket.subject || ticket.ticket_subject || 'No Subject'}`;
      ticketSelect.appendChild(option);
    });

    console.log('loadTickets: populated dropdown with', filteredTickets.length, 'of', tickets.length, 'tickets');
  }

  loadContacts() {
    if (!this._hass) {
      console.log('loadContacts: hass not available yet');
      return;
    }

    const contactSelect = this.shadowRoot.getElementById('contact-select');
    if (!contactSelect) {
      console.log('loadContacts: contact-select element not found');
      return;
    }

    // Try to find the contacts entity
    let entity = this.contactsEntity ? this._hass.states[this.contactsEntity] : null;

    // Auto-detect if not configured
    if (!entity) {
      console.log('loadContacts: searching for *_contacts sensor entity...');
      for (const entity_id in this._hass.states) {
        if (entity_id.startsWith('sensor.') && entity_id.endsWith('_contacts')) {
          entity = this._hass.states[entity_id];
          this.contactsEntity = entity_id;
          console.log('loadContacts: found contacts entity:', entity_id);
          break;
        }
      }
    }

    if (!entity) {
      console.log('loadContacts: no contacts entity found');
      return;
    }

    const contacts = entity.attributes && Array.isArray(entity.attributes.contacts)
      ? entity.attributes.contacts
      : [];

    this._contacts = contacts;

    // Populate dropdown with names only
    contactSelect.innerHTML = '';
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Default (HA API contact)';
    contactSelect.appendChild(defaultOption);

    contacts.forEach(contact => {
      const option = document.createElement('option');
      // value = contact ID, text = contact name
      option.value = contact.id != null ? String(contact.id) : '';
      option.textContent = contact.name || 'Unnamed Contact';
      contactSelect.appendChild(option);
    });

    console.log('loadContacts: loaded', contacts.length, 'contacts into dropdown');
  }

  handleTicketSelect(e) {
    const ticketData = e.target.value;
    if (!ticketData) {
      this.shadowRoot.getElementById('ticket-info-box').style.display = 'none';
      return;
    }

    this.selectedTicket = JSON.parse(ticketData);

    // Show ticket info
    const infoBox = this.shadowRoot.getElementById('ticket-info-box');
    infoBox.style.display = 'block';

    this.shadowRoot.getElementById('ticket-info-title').textContent =
      `Ticket #${this.selectedTicket.number || this.selectedTicket.id || '?'}`;
    this.shadowRoot.getElementById('ticket-status').textContent =
      this.selectedTicket.status || 'Unknown';
    this.shadowRoot.getElementById('ticket-priority').textContent =
      this.selectedTicket.priority || 'Unknown';

    // Show last note
    const lastNote = this.selectedTicket.last_note || this.selectedTicket.notes?.[0] || 'No notes yet';
    this.shadowRoot.getElementById('last-note-text').textContent = lastNote;
  }

  toggleTicketDetails() {
    this.expandedTicket = !this.expandedTicket;
    const detailsDiv = this.shadowRoot.getElementById('ticket-details');
    const btn = this.shadowRoot.getElementById('expand-ticket-btn');

    if (this.expandedTicket) {
      detailsDiv.classList.add('visible');
      btn.textContent = 'Hide Full Ticket Details';

      // Load full ticket details
      const historyDiv = this.shadowRoot.getElementById('ticket-history');
      if (this.selectedTicket) {
        let history = `<p><strong>Subject:</strong> ${this.selectedTicket.subject || 'N/A'}</p>`;
        history += `<p><strong>Details:</strong><br>${this.selectedTicket.details || this.selectedTicket.description || 'No details available'}</p>`;

        if (this.selectedTicket.notes && Array.isArray(this.selectedTicket.notes)) {
          history += '<p><strong>Notes:</strong></p>';
          this.selectedTicket.notes.forEach((note, idx) => {
            history += `<p>${idx + 1}. ${note}</p>`;
          });
        }

        historyDiv.innerHTML = history;
      }
    } else {
      detailsDiv.classList.remove('visible');
      btn.textContent = 'Show Full Ticket Details';
    }
  }

  async handleCreateTicket(e) {
    e.preventDefault();

    const ticketType = this.shadowRoot.getElementById('ticket-type').value;
    const subject = this.shadowRoot.getElementById('subject').value;
    const details = this.shadowRoot.getElementById('details').value;
    const priority = this.shadowRoot.getElementById('priority').value;
    const email = this.shadowRoot.getElementById('email').value;
    const phone = this.shadowRoot.getElementById('phone').value;
    const contactSelect = this.shadowRoot.getElementById('contact-select');
    const contactId = contactSelect ? contactSelect.value : '';

    const successMsg = this.shadowRoot.getElementById('create-success-msg');
    const errorMsg = this.shadowRoot.getElementById('create-error-msg');

    successMsg.style.display = 'none';
    errorMsg.style.display = 'none';

    const enhancedDetails = `<div style="background-color: #e3f2fd; border-left: 4px solid #2196F3; padding: 12px; margin-bottom: 15px;">
    <strong>Ticket Type:</strong> ${ticketType}<br>
    <strong>Submitted via:</strong> Dashboard Card
</div>

${details}`;

    try {
      const serviceData = {
        ticket_subject: `[${ticketType}] ${subject}`,
        ticket_details: enhancedDetails,
        ticket_priority: priority,
        email: email || undefined,
        phone: phone,
      };

      // If a contact is selected, pass its ID as contact_id so ticket is created under that contact
      if (contactId) {
        serviceData.contact_id = parseInt(contactId, 10);
      }

      await this._hass.callService('onoff_itflow', 'create_ticket', serviceData);

      successMsg.style.display = 'block';
      this.shadowRoot.getElementById('ticket-form').reset();

      // Re-add default option to contact dropdown after reset
      const contactSelectAfter = this.shadowRoot.getElementById('contact-select');
      if (contactSelectAfter) {
        contactSelectAfter.innerHTML = '';
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Default (HA API contact)';
        contactSelectAfter.appendChild(defaultOption);
        // Re-populate contacts
        this.loadContacts();
      }

      setTimeout(() => {
        successMsg.style.display = 'none';
      }, 3000);

    } catch (error) {
      console.error('Error creating ticket:', error);
      errorMsg.style.display = 'block';
      setTimeout(() => {
        errorMsg.style.display = 'none';
      }, 5000);
    }
  }

  async handleReplyTicket(e) {
    e.preventDefault();

    if (!this.selectedTicket) {
      const errorMsg = this.shadowRoot.getElementById('reply-error-msg');
      errorMsg.textContent = '✗ Please select a ticket first';
      errorMsg.style.display = 'block';
      setTimeout(() => errorMsg.style.display = 'none', 3000);
      return;
    }

    const replyText = this.shadowRoot.getElementById('reply-text').value;
    const successMsg = this.shadowRoot.getElementById('reply-success-msg');
    const errorMsg = this.shadowRoot.getElementById('reply-error-msg');

    successMsg.style.display = 'none';
    errorMsg.style.display = 'none';

    // Validate reply text
    if (!replyText || replyText.trim() === '') {
      errorMsg.textContent = '✗ Please enter a reply message';
      errorMsg.style.display = 'block';
      setTimeout(() => errorMsg.style.display = 'none', 3000);
      return;
    }

    try {
      // Get the ticket ID - try multiple possible fields
      const ticketId = this.selectedTicket.ticket_id ||
                      this.selectedTicket.id ||
                      this.selectedTicket.number ||
                      this.selectedTicket.ticket_number;

      console.log('=== REPLY DEBUG ===');
      console.log('Selected Ticket Object:', this.selectedTicket);
      console.log('Extracted Ticket ID:', ticketId);
      console.log('Reply Text:', replyText);

      if (!ticketId) {
        throw new Error('Unable to determine ticket ID from selected ticket');
      }

      console.log('Calling reply_to_ticket service with:', {
        ticket_id: String(ticketId),
        reply_text: replyText
      });

      // Call the reply service
      const result = await this._hass.callService('onoff_itflow', 'reply_to_ticket', {
        ticket_id: String(ticketId),
        reply_text: replyText,
      });

      console.log('Reply service result:', result);

      successMsg.style.display = 'block';
      this.shadowRoot.getElementById('reply-text').value = '';

      setTimeout(() => {
        successMsg.style.display = 'none';
      }, 3000);

    } catch (error) {
      console.error('=== REPLY ERROR ===');
      console.error('Error object:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      errorMsg.textContent = `✗ ${error.message || 'Failed to send reply. Check console for details.'}`;
      errorMsg.style.display = 'block';
      setTimeout(() => {
        errorMsg.style.display = 'none';
      }, 5000);
    }
  }

  getCardSize() {
    return this.activeTab === 'reply' ? 6 : 5;
  }

  static getConfigElement() {
    return document.createElement('onoff-create-ticket-card-editor');
  }

  static getStubConfig() {
    return {
      tickets_entity: 'sensor.itflow_open_tickets',
      contacts_entity: 'sensor.test_contacts',
      show_reply_tab: true
    };
  }
}

// Visual Editor
class OnOffCreateTicketCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this.render();
  }

  render() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' });
    }

    this.shadowRoot.innerHTML = `
      <style>
        .config-row {
          margin: 10px 0;
        }
        label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
        }
        input[type="text"] {
          width: 100%;
          padding: 8px;
          border: 1px solid #ccc;
          border-radius: 4px;
          box-sizing: border-box;
        }
        input[type="checkbox"] {
          margin-right: 8px;
        }
        .checkbox-label {
          display: flex;
          align-items: center;
          cursor: pointer;
        }
      </style>
      <div class="config-row">
        <label>Tickets Entity (optional - auto-detects if empty)</label>
        <input type="text" id="tickets-entity" .value="${this._config.tickets_entity || ''}" placeholder="sensor.itflow_open_tickets">
      </div>
      <div class="config-row">
        <label>Contacts Entity (optional - auto-detects if empty)</label>
        <input type="text" id="contacts-entity" .value="${this._config.contacts_entity || ''}" placeholder="sensor.test_contacts">
      </div>
      <div class="config-row">
        <label class="checkbox-label">
          <input type="checkbox" id="show-reply" ${this._config.show_reply_tab !== false ? 'checked' : ''}>
          Show Reply to Ticket Tab
        </label>
      </div>
    `;

    this.shadowRoot.getElementById('tickets-entity').addEventListener('input', (e) => {
      this._config = { ...this._config, tickets_entity: e.target.value };
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config } }));
    });

    this.shadowRoot.getElementById('contacts-entity').addEventListener('input', (e) => {
      this._config = { ...this._config, contacts_entity: e.target.value };
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config } }));
    });

    this.shadowRoot.getElementById('show-reply').addEventListener('change', (e) => {
      this._config = { ...this._config, show_reply_tab: e.target.checked };
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config } }));
    });
  }
}

customElements.define('onoff-create-ticket-card', OnOffCreateTicketCard);
customElements.define('onoff-create-ticket-card-editor', OnOffCreateTicketCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'onoff-create-ticket-card',
  name: 'OnOff Create Ticket Card',
  description: 'Create new tickets or reply to existing ones',
  preview: true,
});
