var config = {};
config.limits = {};
config.limits.time = 10000;
config.limits.attempts = 4;
// IMAP configuration
config.imap = {};
config.imap.user      = '';
config.imap.password  = '';
config.imap.host      = '';
config.imap.port      = 993;
config.imap.tls       = 'true';
// Nodemailer transport -- see https://github.com/nodemailer/nodemailer#set-up-smtp for transport options
config.transport = {};
config.transport.host     = '';
config.transport.port     = 465;
config.transport.secure   = true;
config.transport.user     = '';
config.transport.pass     = '';
// Mailbox configuration
config.box = {};
config.box.in   = 'INBOX';
config.box.pend = 'PENDBOX';
config.box.sent = 'SENTBOX';
config.box.fail = 'FAILBOX';
// Mailing List configuration
config.list = {};
config.list.from    = 'Node Mailist <mailist@host>';
config.list.heading = '[]';

module.exports = config;
