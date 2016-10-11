var Imap = require('imap'),
    inspect = require('util').inspect;

var nodemailer = require('nodemailer');

var config = require('./config.js');

var imap = new Imap(config.imap);

/*
  1. on connection establish:
  Read all mail in INBOX
  For each mail in INBOX, move to PENDBOX
  For each mail in PENDBOX, attempt:
    * app creates a list of recipients and their status
    * replace Title with '[Mindfire Directive] *' or similar
    * attempt to send to each recipient and mark their status as such
    * Once all recipients are a success or a timeout is reached, move to SENTBOX
*/

var STATE_INIT_BOXES = 0;
var STATE_GO_INBOX = 10, STATE_INBOX = 11, STATE_INBOX_WAIT = 12;
var STATE_GO_PEND = 20, STATE_PEND = 21;
var state = STATE_INIT_BOXES;
var checked_inbox = 0;
var main_timer = null;
var attempts = 0;
function makeAttempt() {
  attempts++;
  console.log('waiting ' + config.limits.time +' before reconnecting');
  main_timer = setTimeout(runMain, config.limits.time);
}

imap.on('ready', function() {
  state = STATE_INIT_BOXES;
  runMain();
});
imap.on('error', function(err) {
  checked_inbox = 0;
  state = STATE_GO_INBOX;
  console.log(err);
  makeAttempt();
});
imap.on('end', function() {
  console.log('I: Connection ended!');
  checked_inbox = 0;
  state = STATE_GO_INBOX;
  makeAttempt();
});

imap.on('mail', function(count) {
  console.log('I: mail');
  if (state == STATE_INBOX_WAIT) {
    state = STATE_INBOX;
    runMain();
  }
  //runMain();
});

function mainLoop() {
  main_timer = setTimeout(runMain, config.limits.time);
  console.log('D: waiting ' + config.limits.time + 'ms...');
}

function runMain() {
  if (attempts >= config.limits.attempts) {
    exit(1);
  }
  if (imap.state == 'disconnected') {
    imap.connect();
  } else {
    if (state == STATE_INIT_BOXES) {
      imap.addBox(config.box.in, function(e) {
        imap.addBox(config.box.pend, function(e) {
          imap.addBox(config.box.sent, function(e) {
            imap.addBox(config.box.fail, function(e) {
              state = STATE_GO_INBOX;
              runMain();
            });
          });
        });
      });
    } else if (state == STATE_GO_INBOX) {
      console.log('D: Opening '+config.box.in+'...');
      imap.openBox(config.box.in, true, onInbox);
    } else if (state == STATE_INBOX) {
      console.log('D: Checking '+config.box.in+'...');
      checkInbox();
    } else if (state == STATE_GO_PEND) {
      console.log('D: Opening '+config.box.pend+'...');
      imap.closeBox(true, function(err) {
        if (err) {
          console.log('E: ' + err);
          mainLoop();
          return;
        }
        imap.openBox(config.box.pend, true, onPendbox);
      });
    } else if (state == STATE_PEND) {
      console.log('D: Checking '+config.box.pend+'...');
      checkPendbox();
    }
  }
};


function checkPendbox() {
  var search = imap.search(['ALL'], function(err, results) {
    if (err) throw err;
    if (results.length == 0) {
      state = STATE_INBOX_WAIT;
      console.log('No messages, waiting...');
      return;
    }
    console.log('fetching ' + results);
    try {
      var f = imap.fetch(results, { bodies: '' });
    } catch(e) {
      console.log('D: '+e);
      mainLoop();
      return;
    }
    f.on('message', function(msg, seqno) {
      msg.on('body', function(stream, info) {
        var buffer = '';
        stream.on('data', function(chunk) {
          buffer += chunk.toString('utf8');
        });
        stream.once('end', function() {
          //console.log(buffer);
          console.log(seqno+'END');
        });
      });
      msg.once('attributes', function(attrs) {
        //console.log(seqno+'-ATTR');
        //console.log(attrs);
      });
      msg.once('end', function() {
        console.log('sending ' + seqno);
      });
    });
    f.once('error', function(err) {
      console.log('Fetch error: ' + err);
    });
    f.once('end', function() {
      console.log('Touched all messages!');
      state = STATE_GO_INBOX;
      runMain();
    });
  });
}

function checkInbox() {
  var search = imap.search(['ALL'], function(err, results) {
    if (err) throw err;
    if (results.length == 0) {
      if (!checked_inbox) {
        state = STATE_GO_PEND;
        checked_inbox = true;
        runMain();
      } else {
        state = STATE_INBOX_WAIT;
        console.log('No messages, waiting...');
      }
      return;
    }
    console.log('I: moving ' + results.length +' messages');
    for (var i = 0; i < results.length; i++) {
      imap.move(results[i], config.box.pend, function(e) {
        if (e) console.log('E: ' + e);
      });
    }
    state = STATE_GO_PEND;
    runMain();
  });
}

function onInbox(err, box) {
  if (err) throw err;
  state = STATE_INBOX;
  runMain();
}

function onPendbox(err, box) {
  if (err) throw err;
  state = STATE_PEND;
  runMain();
  // 1. fetch all messages
  // 2. attempt to send all messages -- once sent, move to sentbox
}

runMain();
