var express = require('express');
var app = express();
//var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var path = require('path');

app.use(express.static('public'))

app.get('/imagecaption', (req, res) => {
  res.sendFile(__dirname + '/imagecaption.html');
});

http.listen(process.env.PORT || 3000, () => {
    console.log('listening on *:3000');
});

// Debug Console
var userCount = 0;
io.on('connection', (socket) => {
    userCount = userCount + 1;
    console.log('user connected: #' + userCount);
    socket.on('disconnect', () => {
        userCount = userCount - 1;
        console.log('user disconnected: #' + userCount);
    });
});

var msgArray = [];

io.on('connection', (socket) => {
    socket.on('imagecaption', (msg) => {
        msgArray.push(msg);
        console.log(msgArray);

        if (userCount == msgArray.length && userCount > 0) { // if all users have submitted, display array values
            io.emit('imagecaption', msgArray);
            msgArray = [];
            
            console.log("All users have made an input");
            
            console.log('message Array: ' + msgArray); 
            io.emit('imagecaption', msgArray);
            msgArray = [];
        }
        
    });
});




setTimeout(function() { // all user inputs displayed after 15 sec
    console.log('message Array: ' + msgArray); 
    io.emit('imagecaption', msgArray);
    msgArray = [];
}, 15000);

