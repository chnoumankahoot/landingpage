var express = require('express');
var app = express();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var path = require('path');
const multer = require("multer");
const sqlite3 = require('sqlite3').verbose();

let db = new sqlite3.Database('./sqlite.db', (err) => {
  if (err) {
    return console.error(err.message);
  }
  console.log('Connected to the SQlite database.');
});

round = {};

dbSchema = `CREATE TABLE IF NOT EXISTS Users (
  id text NOT NULL PRIMARY KEY,
  username text NOT NULL,
  room text NOT NULL,
  caption text NOT NULL,
  state text,
  score integer,
  round integer
);

CREATE TABLE IF NOT EXISTS Captions (
  id text NOT NULL,
  room text NOT NULL,
  caption text NOT NULL PRIMARY KEY,
  votes integer NOT NULL,
  round integer NOT NULL,
  FOREIGN KEY (id)
       REFERENCES Users (id) 
)` // add round to captions table

db.exec(dbSchema, function(err){
  if (err) {
      console.log(err)
  }else{
    console.log('successfully executed schema');
  }
});

http.listen(process.env.PORT || 3000, () => {
  console.log('listening on *:3000');
});

app.use(express.static('public'));


app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.get('/game', (req, res) => {
  res.sendFile(__dirname + '/game.html');
});

io.on('connection', (socket) => {
  socket.on('join room', (room) => {
    socket.join(room);
  });


  console.log('a user connected');
  socket.on('disconnect', (room) => {
    console.log('user disconnected');
    
    db.get(`SELECT username FROM Users WHERE id = ?`, [socket.id], function(err, row) {
      if(err) {
        return console.error(err.message);
      }
      return row
        ? io.to(room).emit('user left', row.username) // ## doesn't work ## // add io.to(room).emit('chat message', row.username+' left the game. :(') 
        : console.log('Update Round didnt work')
    });

    db.run(`DELETE FROM Users WHERE id = ? `, [socket.id], function(err) {
        if (err) {
          return console.log(err.message);
        }
        console.log(`A user left the game.` + [socket.id]);
      });
  });

  socket.on('enter name', (name, room) => {
    var key = room;
    if(!(key in round)){
      round[key]=1;
      console.log('round in room set to 1');
    }
    console.log('round in room: '+round[key]);
    db.run(`INSERT INTO Users VALUES(?,?,?,?,?,?,?)`, [socket.id, name, room, '', 'thinking', 0, round[key]], function(err) {
      if (err) {
        return console.log(err.message);
      }
      // get the last insert id
      console.log(`A row has been inserted with rowid ${this.lastID}`);
    });

    let sql = `SELECT id, username name, room FROM Users WHERE room = ?`;

    db.all(sql, [room], (err, rows) => {
      if (err) {
        throw err;
      }
      rows.forEach((row) => {
        socket.emit('new username', row.id, row.name);
        console.log('new user: '+row.name);
        //console.log(row.name);
      });
    });

    socket.broadcast.to(room).emit('new username', socket.id, name);
    io.to(room).emit('chat message', name+' joined the game 🎉');

  });
});

io.on('connection', (socket) => {
  socket.on('chat message', (msg,room) => {
    var text;

    db.get(`SELECT username name, id FROM Users WHERE id = ?`, [socket.id], (err, row) => {
      text = row.name+': '+msg;
      console.log(text);

      return row
    ? io.to(room).emit('chat message', row.name+': '+msg)
    : console.log(`No user found with the id ${socket.id}, length:`+ socket.id.length);
    });
  });
});

io.on('connection', (socket) => {
  socket.on('switch meme', (room) => {
      let tmp = Math.floor(Math.random() * 7)+1;
      console.log("New meme: "+tmp);
      io.to(room).emit('switch meme', tmp);
    });
});

// include node fs module
var fs = require('fs');
const { stringify } = require('querystring');
 
// writeFile function with filename, content and callback function
io.on('connection', (socket) => {
  socket.on('create file', () => {

    var filename = Date.now();
    const newLocal = "<!doctype html><html><head> <meta name='viewport' content='width=device-width, initial-scale=1.0'> <title>Caption This.</title> <link rel='stylesheet' href='https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css' integrity='sha384-ggOyR0iXCbMQv3Xipma34MD+dH/1fQ784/j6cY/iJTQUOhcWr7x9JvoRxT2MZw1T' crossorigin='anonymous'> <link rel='stylesheet' href='/css/styles.css'> <style></style></head><body> <div class='modal' id='username-layer' tabindex='-1' role='dialog' data-backdrop='static' data-keyboard='false'> <div class='modal-dialog' role='document'> <div class='modal-content'> <div class='modal-header'> <h5 class='modal-title'>Username</h5> </div><div class='modal-body'> Upload your own images: <span class='text-muted'>(optional)</span> <form id='image-upload' method='post' enctype='multipart/form-data' action='/game'> <input type='file' name='file'> <input type='submit' value='Submit'> </form> Enter your Name: <br><form action='' id='name-submit'><input type='text' id='input-name'></form> </div></div></div></div><div class='modal' id='voting-layer' tabindex='-1' role='dialog'> <div class='modal-dialog' role='document'> <div class='modal-content'> <div class='modal-header'> <h5 class='modal-title'>Time To Vote!</h5> <span aria-hidden='true'>&times;</span> </button> </div><div class='modal-body'> <img src='/images/1.jpg' alt='' id='meme-vote'> <p id='waitingForPlayers'>Waiting for other players ...</p><br><ul id='captions'></ul> </div></div></div></div><div class='container-fluid'> <div> <button id='switch-meme' class='btn btn-dark'>Switch Meme</button><br></div><div class='fr'> <p id='current-round'>Round _ out of 10</p><ul id='active-users'> </ul> </div><div class='meme-wrapper'> <img id='meme' src='/images/1.jpg' alt=''> </div><div id='icArray'></div><form action='' id='imagecaptionform'> <div class='form-group row'> <div class='col-sm-9'> <input autocomplete='off' type='text' class='form-control-plaintext' id='ic' placeholder='When you can`t think of a caption ...'> </div><div class='col-sm-3'><button class='btn'>Submit Caption</button></div></div></form> <ul id='messages'></ul></div><footer class='sticky-footer'> <form action='' id='chat'> <div class='form-group row'> <div class='' style='width: 75%;'><input style='width: 90%;' id='m' autocomplete='off'/></div><div class='' style='width: 20%'><button class='btn btn-primary footer-btn'>Send</button></div></div></form></footer> <div class='modal' id='winner-layer' tabindex='-1' role='dialog'> <div class='modal-dialog' role='document'> <div class='modal-content'> <div class='modal-body'> <h2 id='winnername'></h2> <p id='winnerscore'></p><button id='new-game'>start new game!</button> </div></div></div></div><script src='/socket.io/socket.io.js'></script> <script src='https://code.jquery.com/jquery-3.3.1.slim.min.js' integrity='sha384-q8i/X+965DzO0rT7abK41JStQIAqVgRVzpbzo5smXKp4YfRvH+8abtTE1Pi6jizo' crossorigin='anonymous'></script> <script src='https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.14.7/umd/popper.min.js' integrity='sha384-UO2eT0CpHqdSJQ6hJty5KVphtPhzWj9WO1clHTMGa3JDZwrnQq4sF86dIHNDz0W1' crossorigin='anonymous'></script> <script src='https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/js/bootstrap.min.js' integrity='sha384-JjSmVgyd0p3pXB1rRibZUAYoIIy6OrQ6VrjIEaFf/nJGzIxFDsf4x0xIM+B07jRM' crossorigin='anonymous'></script> <script>var sendID; $(function (){var socket=io(); var room=document.location.pathname; $(document).ready(function (){socket.emit('join room', room); console.log('Room: ' + room);}); $(document).ready(function (e){$('#username-layer').modal('show');}); $('#name-submit').submit(function (e){e.preventDefault(); socket.emit('enter name', $('#input-name').val(), room); $('#username-layer').modal('hide'); return false;}); $('#chat').submit(function (e){e.preventDefault(); socket.emit('chat message', $('#m').val(), room); $('#m').val(''); return false;}); $('#switch-meme').click(function (e){e.preventDefault(); socket.emit('switch meme', room);}); $('#create-file').click(function (e){e.preventDefault(); socket.emit('create file');}); $('#imagecaptionform').submit(function (e){e.preventDefault(); /* prevents page reloading */ var caption=$('#ic').val(); socket.emit('caption', caption, room); $('#voting-layer').modal('show'); $('#ic').val(''); return false;}); socket.on('new username', function (id, name){var newID=id+'name'; $('#active-users').append($('<li>').text(name).attr('id', newID)); $('#'+newID).append($('<span>').text('0'));}); socket.on('chat message', function (msg){console.log(msg); $('#messages').append($('<li>').text(msg));}); socket.on('switch meme', function (tmp){$('#meme').attr('src', '/images/' + tmp + '.jpg'); $('#meme-vote').attr('src', '/images/' + tmp + '.jpg'); console.log(tmp);}); socket.on('user left', function (username){$('#' + username).css('display', 'none'); console.log(username + ' left the game');}); sendID=function (btnid, caption){console.log(btnid, caption); socket.emit('vote', btnid, room, caption); var node=document.getElementById('captions'); node.querySelectorAll('*').forEach(n=> n.remove()); $('#voting-layer').modal('hide');}; socket.on('caption', function (id, caption){console.log(id+': '+caption); var button_tmp='<li><button onclick=\"sendID(this.id, this.innerHTML)\" id=\"' + id + '\" >' + caption + '</button></li>'; $('#captions').append($(button_tmp)); $('#waitingForPlayers').css('display', 'none');}); socket.on('all voted', function(results){for (const [id, score] of Object.entries(results)){console.log(id+' got '+score+' votes.'); var identifier='.'+id; identifier=identifier.replace(/\s+/g, ''); identifier=identifier+' span'; $(identifier).text(score);}}); socket.on('update score', function(id, score){console.log(id[0],score[0]); for (let i=0; i < id.length; i++){const tmp_id=id[i]+'name'; $('#'+tmp_id+' span').text(score[i]);}}); socket.on('winner', function(winner){console.log('Winner: '+winner[1],winner[2]);}); socket.on('show winner', function(score, username){console.log('Current Score: ' + score + 'Username: ' + username); $('#winnername').text('The winner is ' + username + ' 🎉'); $('#winnerscore').text('('+ score + ' points)'); $('#winner-layer').modal('show');}); socket.on('update round', function(round){console.log('current round: ' + round); $('#current-round').text('Round ' + round + ' out of 10');});}); </script></body></html>"
    var filecontent = newLocal;

    fs.writeFile(filename + '.html', filecontent, function (err) {
      if (err) throw err;
      console.log('File is created successfully.');
      console.log('New File: ' + __dirname + '/' + filename + '.html');
    });

    app.get('/' + filename, (req, res) => {
      res.sendFile(__dirname + '/' + filename + '.html');
    });

    socket.emit('add link', filename)
  });
});

io.on('connection', (socket) => {
    socket.on('caption', (caption, room) => {

      // update caption for user with id = socket.id
      let sql = `UPDATE Users SET caption = ? WHERE id = ?`;
      db.run(sql, [caption, socket.id], function(err) {
        if (err) {
          return console.error(err.message);
        }
        console.log(caption);
        console.log(`Caption updated to input.`);
      });

      // update state for user with id = socket.id
      let sql2 = `UPDATE Users SET state = ? WHERE id = ?`;
      db.run(sql2, ['submitted', socket.id], function(err) {
        if (err) {
          return console.error(err.message);
        }
        console.log(`State updated to submitted.`);
      });

      // update round for user with id = socket.id
      let sql3 = `UPDATE Users SET round = round+1 WHERE id = ?`;
      db.run(sql3, [socket.id], function(err) {
        if (err) {
          return console.error(err.message);
        }
        console.log(`Round updated (increased by 1).`);
      });
      var key = room;
      // insert caption into table
      db.run(`INSERT INTO Captions VALUES(?,?,?,?,?)`, [socket.id, room, caption, 0, round[key]], function(err) {
        console.log('Insert into caption reached');
        if (err) {
          return console.log(err.message);
        }
        // get the last insert id
        console.log(`A new caption has been inserted with rowid ${this.lastID}`);
      });
  
      // check if all users submitted a caption, if yes -> emitCaptions
      db.all(`SELECT room, state FROM Users WHERE room = ? AND NOT state = ?`, [room, 'submitted'], (err, rows) => {
        console.log('state is not submitted for: '+rows);
        if(rows == '' || rows == null || rows == undefined){emitCaptions(room)}
        return rows
      });

    });

    // function to emit a caption with id
    function emitCaptions(room){
      console.log('reached emitCaptions function');
      db.all(`SELECT id, room, state, caption FROM Users WHERE room = ? AND state = ?`, [room, 'submitted'], (err, users) => {
        console.log('users with state submitted: '+users);
        return users
      ? users.forEach(user => {
        io.to(room).emit('caption', user.id, user.caption)
      })
      : console.log(`Oops, something went wrong!`);
      })
    }
});

// setTimeout(function() { // all user inputs displayed after 15 sec
//     io.to(room).emit('caption', cptObj);
//     cptObj = [];
// }, 15000);

io.on('connection', (socket) => {
  socket.on('vote', (Id, room, caption) => {

    // delete space from Buton ID
    Id = Id.replace(/\s/g, '');
    console.log('Button ID: '+Id+' socket.id: '+socket.id);

    // debugging
    db.get(`SELECT id FROM Users WHERE id = ?`, [Id], (err, row) => {
      console.log('Voted for: '+row.id);
    });

    // Update caption votes
    db.run(`UPDATE Captions SET votes = votes+1 WHERE caption = ?`, [caption], function(err) {
      if (err) {
        return console.error(err.message);
      }
      console.log(`Score for caption updated.`);
    });

    // update score
    let sql = `UPDATE Users SET score = score+1 WHERE id = ?`;
    db.run(sql, [Id], function(err) {
      if (err) {
        return console.error(err.message);
      }
      console.log(`Score updated.`);
    });

    // update state
    let sql2 = `UPDATE Users SET state = 'voted' WHERE id = ?`;
    db.run(sql2, [socket.id], function(err) {
      if (err) {
        return console.error(err.message);
      }
      console.log(`State updated to voted.`);
    });

    db.all(`SELECT room, state FROM Users WHERE room = ? AND NOT state = ?`, [room, 'voted'], (err, rows) => {
      console.log('state is not voted for: '+rows);
      if(rows == '' || rows == null || rows == undefined){emitUpdates(room)}
      return rows
    });


    //setTimeout(function(){updateRound(room, io)},500);
    setTimeout(function(){updateScores(room, io)},500);
    //setTimeout(function(){showWinner(room, io)},500); 
  });
});

function emitUpdates(room){
  
  console.log('reached emitUpdates function');
  var key = room;
  // was machen wir mit gleichstand?????????????????????????
  db.get(`SELECT MAX(votes) votes, room, round FROM Captions WHERE room = ? AND round = ?`, [room, round[key]], (err, caption) => {
    console.log('captions from current round: '+caption+' round: '+caption.round);
    return caption
  ? io.to(caption.room).emit('update round', caption.round)
  : console.log('error: at update round');
  });
  round[key]++;
}

function updateScores(room, io) {
  db.all(`SELECT id, caption, votes FROM Captions WHERE room = ? AND round = ?`, [room, round[room]], function(err, rows){
    if(err){
      return console.error(err.message);
    }
    var winner = [];
    rows.forEach((row) => {
      console.log(row.votes+' winner.length: '+winner.length);
      if(winner.length == 0){
        winner = [row.id, row.caption, row.votes];
      }else{
        if(winner[2]<row.votes){
          winner = [row.id, row.caption, row.votes];
        }else{
          console.log(row.votes+' is not bigger than '+winner[2]);
        }
      }
    });
    io.to(room).emit('winner', winner);
  });

  db.all(`SELECT id, score FROM Users WHERE room = ?`, [room], function(err, rows){
    if(err){
      return console.error(err.message);
    }
    var scores = [];
    var ids = [];
    rows.forEach((row) => {
      console.log(row.id+' scored: '+row.score);
      scores.push(row.score);
      ids.push(row.id)
    });
    io.to(room).emit('update score', ids, scores);
  });
};

// var sessionFinish;
function updateRound(room, io) {
  db.get(`SELECT MAX(round) round FROM Users WHERE room = ?`, [room], function(err, row) {
    if(err) {
      return console.error(err.message);
    }
    if(row.round == 3) {
      sessionFinish = true;
      console.log('sessionFinish: ' + sessionFinish);
    }
    return row
      ? io.to(room).emit('update round', row.round)
      : console.log('Update Round did not work')
  });
};

function showWinner(room, io) {
  if(sessionFinish == true) { // sessionFinish is not defined in here (scoping)
    db.get(`SELECT MAX(score) score, username FROM Users WHERE room = ?`, [room], function(err, row) {
      if(err) {
        return console.error(err.message);
      }
      return row
        ? io.to(room).emit('show winner', row.score, row.username)
        : console.log('Winner modal did not show up but should.')
    });
  }
};

// image upload

const handleError = (err, res) => {
  res
    .status(500)
    .contentType("text/plain")
    .end("Oops! Something went wrong!");
};

const upload = multer({
  dest: "/uploads"
});


app.post(
  "/game",
  upload.single("file" /* name attribute of <file> element in your form */),
  (req, res) => {
    const tempPath = req.file.path;
    const targetPath = path.join(__dirname, "/uploads/"+imgname+".jpg");
    imgname++;

    if (path.extname(req.file.originalname).toLowerCase() === ".jpg") {
      fs.rename(tempPath, targetPath, err => {
        if (err) return handleError(err, res);

        res
          .status(200)
          .sendFile(__dirname + '/game.html');

      });
    } else {
      fs.unlink(tempPath, err => {
        if (err) return handleError(err, res);

        res
          .status(403)
          .contentType("text/plain")
          .end("Only .jpg files are allowed!");
      });
    }
  }
);