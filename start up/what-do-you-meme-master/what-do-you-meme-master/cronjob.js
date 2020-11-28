const cron = require("node-cron"); 
var path = require('path');
var fs = require('fs'); // include node fs module (filesystem)
var rimraf = require('rimraf'); // include node module to delete files

var uploadsDir = __dirname + '/demofiles'; // directory where files should be deleted  

// Creating a cron job which runs on every 10 second 
cron.schedule("*/10 * * * * *", function() { // set to 24 h
    console.log("running cronjob every 10 seconds"); 

    fs.readdir(uploadsDir, function(err, files) {
        files.forEach(function(file, index) {
          fs.stat(path.join(uploadsDir, file), function(err, stat) {
            var endTime, now;
            if (err) {
              return console.error(err);
            }
            now = new Date().getTime();
            endTime = new Date(stat.ctime).getTime() + 30000; // 86400000 = 24 h  // file age
            if (now > endTime) {
              return rimraf(path.join(uploadsDir, file), function(err) {
                if (err) {
                  return console.error(err);
                }
                console.log(file + ' was successfully deleted');
              });
            }
          });
        });
      });

}); 








