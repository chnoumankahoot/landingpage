// include node fs module
var fs = require('fs');

var filename = Date.now() + '.html';

var filecontent = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>' + filename + '</title></head><body><p>Neue Gruppe: ' + filename + '</p></body></html>';
 
// writeFile function with filename, content and callback function
fs.writeFile(filename, filecontent, function (err) {
  if (err) throw err;
  console.log('File is created successfully.');
  console.log('New File: ' + __dirname + '/' + filename);
});