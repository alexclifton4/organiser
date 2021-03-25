// server.js
// where your node app starts

// init project
const express = require('express');
const app = express();
const fs = require("fs");
const dateFormat = require("dateformat")
const redirectToHTTPS = require("express-http-to-https").redirectToHTTPS
const cookieParser = require("cookie-parser")
const hash = require("password-hash")
const gmailSend = require("gmail-send")

const database = require('./db.js');

// we've started you off with Express, 
// but feel free to use whatever libs or frameworks you'd like through `package.json`.

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));
app.use(express.urlencoded({extended: false}))
app.use(express.json())
app.use(redirectToHTTPS([/localhost:(\d{4})/]))
app.use(cookieParser())

// Cron for sending emails
app.post("/cron", (req,res) => {
  // get current date
  let now = new Date().getTime()
  // get entries that havent been sent yet
  let db = database.connect()
  let sql = "SELECT rowid, * FROM entries WHERE notificationSent = 0 AND notificationdate != ''"
  db.query(sql, (err, data) => {
    if (err) throw err
    // Filter out rows that have a notification date in the future
    data = data.rows.filter(row => 
      new Date(row.notificationdate).getTime() < new Date().getTime()
    )

    // Send notifications if there is data
    if (data.length > 0) {
      sendNotification(data, res)
    } else {
      res.send("None to send")
    }
    db.end()
  })
})

app.post('/login', (req, res) => {
  // Check the password
  if (hash.verify(req.body.password, process.env.PASSWORD)) {
    res.cookie("token", process.env.ACCESS_TOKEN, {maxAge: 2147483647})
    res.redirect("/")
  } else {
    res.send("Incorrect Password")
  }
})

app.all('*', (req, res, next) => {
  // Check if token is valid
  if (req.cookies.token == process.env.ACCESS_TOKEN) {
    next()
  } else {
    let file = fs.readFileSync(__dirname + '/views/login.html').toString()
    file = file.replace(/TITLE/g, process.env.TITLE)
    res.write(file);
    res.end()
  }
})

//send app page
app.get('/', function(request, response) {
  let file = fs.readFileSync(__dirname + '/views/app.html').toString()
  file = file.replace(/TITLE/g, process.env.TITLE)
  file = file.replace(/COLOUR/g, process.env.COLOUR)
  response.writeHead(200, {'Content-Type': 'text/html'});
  response.write(file);
  response.end()
});

// Send HTML page for all entries
app.get('/all.html', (req, res) => {
  let file = fs.readFileSync(__dirname + '/views/all.html').toString()
  file = file.replace(/TITLE/g, process.env.TITLE)
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.write(file);
  res.end()
});

//send all entries
app.get('/all', (req, res) => {
  let db = database.connect()
  let sql = "SELECT rowid AS id, title, date, company FROM entries ORDER BY date"
  db.query(sql, (err, data) => {
    if (err) throw err;
    res.send(data.rows)
    db.end()
  })
})

//send one entry
app.get('/entry', (req, res) => {
  //query db
  let db = database.connect()
  let sql = "SELECT rowid AS id, * FROM entries WHERE rowid = $1"
  db.query(sql, [req.query.id], (err, data) => {
    if (err) throw err
    res.send(data.rows[0])
    db.end()
  })
})

//receive new entry
app.post('/addNew', (req, res) => {
  //insert into db
  let db = database.connect()
  let sql = "INSERT INTO entries (title, date, notes, phone, cost, payment, company, notificationDate, notificationSent) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0)";
  db.query(sql, [req.body.title, req.body.date, req.body.notes, req.body.phone, req.body.cost, req.body.payment, req.body.company, req.body.notDate], (err) => {
    if (err) throw err
    res.send("done")
    db.end()
  })
})

//receive updated entry
app.post('/save', (req, res) => {
  //update db
  let db = database.connect()
  //title: title, date: date, notes: notes, notDate: notDate, phone: phone, cost: cost, payment: payment, company: company
  let sql = "UPDATE entries SET title = $1, date = $2, phone = $3, cost = $4, payment = $5, company = $6, notes = $7, notificationDate = $8, notificationSent = 0 WHERE rowid = $9"
  db.query(sql, [req.body.title, req.body.date, req.body.phone, req.body.cost, req.body.payment, req.body.company, req.body.notes, req.body.notDate, req.body.id], (err) => {
    if (err) throw err
    res.send("done");
    db.end()
  })
})

//delete an entry
app.post('/delete', (req, res) => {
  //update db
  let db = database.connect()
  let sql = "DELETE FROM entries WHERE rowid = $1"
  db.query(sql, [req.body.id], (err) => {
    if (err) throw err
    res.send("done");
    db.end()
  })
})

// Actually sends the notification email
let sendNotification = function(entries, res) {
  let email = gmailSend({
    user: process.env.EMAIL_FROM,
    pass: process.env.EMAIL_PASSWORD,
    to: process.env.EMAIL_TO,
    subject: "Organiser Reminders - " + process.env.TITLE
  })
  
  // Generate the content
  let generatedEmail = generateEmail(entries)
  let content = generatedEmail.content
  
  email({html: content}, (err) => {
    if (err) {
      console.log(err)
      res.send("Email failed: " + err)
    } else {
      res.send("Email sent")
      markAsSent(generatedEmail.ids)
    }
  })
}

// Sets the notification flag to sent
let markAsSent = function(ids) {
  let db = database.connect()
  let sql = "UPDATE entries SET notificationSent = 1 WHERE rowid IN (" + ids.join(",") + ")"
  db.query(sql, [], (err) => {
    if (err) throw err
    db.end()
  })
}

// Makes a string for sending data in email
let generateEmail = function(data) {
  let email = "";
  
  let ids = []
  
  for (let i = 0; i < data.length; i++){
    // Make sure the date is in the past
    if (new Date(data[i].notificationdate).getTime() < new Date().getTime()){
        email += `<hr><p><b>Title:</b>${data[i].title}</p>`
        email += `<p><b>Date:</b>${dateFormat(data[i].date, "dd/mm/yyyy")}</o>`
        email += `<p><b>Notes:</b>${data[i].notes}</p>`
        email += `<p><a href="https://organiser${process.env.TITLE}.herokuapp.com/?id=${data[i].rowid}">View in organiser</a></p>`
        ids.push(data[i].rowid)
    }
  }
  
  // Add header to email
  email = `<h1>Organiser reminders - ${process.env.TITLE}</h1><p>Upcoming reminders: <b>${ids.length}</b></p>` + email
  
  return {
    content: email,
    ids: ids
  }
}

// listen for requests :)
const listener = app.listen(process.env.PORT || 8080, function() {
  console.log('Your app is listening on port ' + listener.address().port);
});
