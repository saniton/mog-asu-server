// server.js
require('dotenv').config();
const express = require('express');
const requestIp = require('request-ip');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const path = require('path'); // Add this line
const cors = require('cors');
const fastCsv = require('fast-csv');
const fs = require('fs');
const { decode } = require('punycode');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const app = express();
const PORT = process.env.PORT || 5000;
const mdb_url = process.env.MONGODB_URI;
console.log("url:"+ mdb_url);

app.use(cors());

// Connect to MongoDB
mongoose.connect(mdb_url, { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;


db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});

// Create a schema for the registration data
const registrationSchema = new mongoose.Schema({
  tableNumber: String,
  name: String,
  phoneNumber: String,
  registrationTime: String,
  ipAddress: String, // Add this line
});

registrationSchema.pre('save', function (next) {
  const currentDate = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  this.registrationTime = currentDate;
  next();
});


const Registration = mongoose.model('dataentry', registrationSchema);

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));



// Serve React app
app.use(express.static(path.join(__dirname, 'client/build'))); // Update this line

// Middleware to get the user's IP address
// app.use(requestIp.mw());
app.use(requestIp.mw({ attributeName : 'clientIp', headerName : 'X-Forwarded-For' }));



// Endpoint for form submission
app.post('/registrations', async (req, res) => {
  console.log('Request Headers:', req.headers);

  try {
    const ipAddress = req.clientIp;
    console.log('User IP Address:', ipAddress);

    const { tableNumber, name, phoneNumber } = req.body;

    // Save data to MongoDB, including IP address
    const newRegistration = new Registration({
      tableNumber,
      name,
      phoneNumber,
      ipAddress, // Add IP address to the registration data
    });

    await newRegistration.save();
    console.log('Data saved to MongoDB');
    res.status(200).send('Registration successful');
  } catch (error) {
    console.error('Error saving to MongoDB:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.get('/health', async (req, res) => {
  console.log('Health api:', req.headers);

    res.status(200).send('healthy!!!');
});


// Endpoint for retrieving data from MongoDB
app.get('/submission', async (req, res) => {
  try {
    const Data = await Registration.find({}).sort({ registrationTime: -1 }).limit(1); // Retrieve last registrations
    console.log('Data Retrieved in submission');
    res.json(Data);
  } catch (error) {
    console.error('Error retrieving data from MongoDB:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// Endpoint for retrieving data from MongoDB in admin page
app.get('/admin', async (req, res) => {
  try {
    const { date } = req.query;
    let query = {};

    if (date) {
      // Parse the incoming date string into a Date object
      const selectedDate = new Date(date);
      
      // Calculate the date for the next day
      const nextDay = new Date(selectedDate);
      nextDay.setDate(selectedDate.getDate() + 1);

      // Format the next day as needed based on your MongoDB date format
      const formattedNextDay = nextDay.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });

      // Query for the next day
      query = { registrationTime: { $regex: new RegExp(`^${formattedNextDay}`) } };
    }

    const Data = await Registration.find(query);
    console.log('Data Retrieved');
    res.json(Data);
  } catch (error) {
    console.error('Error retrieving data from MongoDB:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// To Download the data from Mongodb
app.get('/download-csv', async (req, res) => {
  let nextDay;


  try {
    const { date } = req.query;
    let query = {};

    if (date) {
      // Parse the incoming date string into a Date object
      const selectedDate = new Date(date);
      
      // Calculate the date for the next day
      
      nextDay = new Date(selectedDate);
      nextDay.setDate(selectedDate.getDate() + 1);

      // Format the next day as needed based on your MongoDB date format
      const formattedNextDay = nextDay.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });

      // Query for the next day
      query = { registrationTime: { $regex: new RegExp(`^${formattedNextDay}`) } };
    }

    const data = await Registration.find(query, { _id: 0 });

    // Use the next day's date for the file name
    const formattedNextDayForFile = nextDay.toISOString().split('T')[0];

    const csvWriter = createCsvWriter({
      path: `output_${formattedNextDayForFile}.csv`,  // Use the date parameter for the file name
      header: [
        { id: 'tableNumber', title: 'Table Number' },
        { id: 'name', title: 'Name' },
        { id: 'phoneNumber', title: 'Phone Number' },
        { id: 'registrationTime', title: 'Registration Time'},
      ],
    });

    await csvWriter.writeRecords(data);

    res.attachment(`output_${formattedNextDayForFile}.csv`);  // Set the file name in the response
    res.send('CSV file generated successfully');
    console.log("file downloaded successfully");
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});



//Admin Login Validation
const validUsername = 'admin';
const validPassword = 'admin123';

app.use(bodyParser.json());

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (username === validUsername && password === validPassword) {
    const token = jwt.sign({ username }, process.env.SECRET_KEY, { expiresIn: '60s' });
    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, message: 'Invalid username or password' });
  }
});

app.post('/api/tokenVerify', (req, res) => {
  const { presentToken } = req.body;


  try {
    const decode = jwt.verify(presentToken, process.env.SECRET_KEY);
    res.status(200).json({ success: true, date: decode });
  }
  catch (e) {
    console.log('------', e.message, '-------')
    res.status(401).json({ success: false, message: ('Error while decoding token, Error: '+ e.message) });
  }
});




  
  // Start the server
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });


  // Export the app as a Cloud Function
module.exports = app;
