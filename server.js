const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();
const session = require("express-session");
const MongoStore = require("connect-mongo");
const cors = require('cors');
const path = require('path');
const methodOverride = require("method-override");
console.log(process.env.TELNYX_API_KEY)
const telnyx = require('telnyx')(process.env.TELNYX_API_KEY); // Use environment variable for the API key

const app = express();





app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors({
  origin: 'https://hellopamela.com',  // Your frontend domain
  methods: ['POST', 'GET', 'DELETE', 'PUT'],
  credentials: true,  // Allow credentials (cookies, authorization headers, etc.)
  allowedHeaders: ['Content-Type', 'Authorization'], // Allow necessary headers
}));

// Use forms for put / delete
app.use(methodOverride("_method"));

// Setup Sessions - stored in MongoDB
app.use(
  session({
    secret: "keyboard cat",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ 
      mongoUrl: process.env.MONGODB_URI,
      ttl: 14 * 24 * 60 * 60 }),
  })
);

const PORT = process.env.PORT;

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI).then(() => {
    console.log('MongoDB Connected');
}).catch(err => {
    console.error('MongoDB connection error:', err);
});

// 1. Define Schemas and Models

// Message Schema and Model
const messageSchema = new mongoose.Schema({
    name: String,
    email: String,
    phone: String,
    message: String,
    country: String,
    agreement: Boolean,
}, { timestamps: true });

const Message = mongoose.model('Message', messageSchema);

const bookingSchema = new mongoose.Schema({
  customerName: String,
  email: String,
  cellPhone: String,
  homePhone: String,
  homeAddress: String,
  emergencyContactNumber: String,
  workPhone: String,
  petsName: String,
  petsAge: String,
  dailyRoutine: String,
  petsHealth: String,
  favoriteThings: String,
  idioSyncrasies: String,
  vetPermission: Boolean,
  startDateAndTime: Date,
  endDateAndTime: Date,
  specialRequest: String,
  alarmInfo: String,
  miscNotes: String,
  additionalNotes: String,

  // New fields for travel itinerary
  departureDateTime: Date,
  returnDateTime: Date,
  destination: String,
  emergencyContactName: String,
  emergencyContactPhone: String,
  flightNumber: String,
  departureAirport: String,
  arrivalAirport: String,
}, { timestamps: true });

const Booking = mongoose.model('Booking', bookingSchema);

// Newsletter Subscription Schema and Model
const newsletterSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true }
}, { timestamps: true });

const Newsletter = mongoose.model('Newsletter', newsletterSchema);


const sendMessage = async (req, res) => {
    try {
        const { name, email, phone, message, agreement } = req.body;

        const newMessage = new Message({ name, email, phone, message, agreement });
        await newMessage.save();

       

         const notificationText = `
          New Message Received:
          Name: ${name}
          Email: ${email}
          Phone: ${phone}
          Message: ${message}
        `;

        await telnyx.messages.create({
            from: process.env.TELNYX_PHONE_NUMBER, // Replace with your Telnyx number
            to: process.env.ALERT_PHONE_NUMBER, // Replace with the recipient's number
            text: notificationText,
            messaging_profile_id: '40019437-a458-4665-b01b-894982b862ff',
            
            type: 'SMS'

        });
        console.log("message saved and telnyx text gone through")
        res.status(200).json({ success: true, message: 'Message sent successfully and notification delivered' });
    } catch (error) {
        console.error('Controller Error saving message:', error);
        res.status(500).json({ success: false, message: 'Error sending message' });
    }
};

const getMessages = async (req, res) => {
    try {
        const messages = await Message.find().sort({ createdAt: -1 });
        console.log('Messages from MongoDb: ', messages);
        res.status(200).json(messages);
    } catch (error) {
        console.error('Error retrieving messages:', error);
        res.status(500).json({ success: false, message: 'Error retrieving messages' });
    }
};

const deleteMessage = async (req, res) => {
    try {
        console.log('Delete request received for ID:', req.params.id);
        const messageId = req.params.id;
        const result = await Message.findByIdAndDelete(messageId);

        if (!result) {
            return res.status(404).json({ success: false, message: 'Message not found' });
        }
        res.status(200).json({ success: true, message: 'Message deleted successfully' });
    } catch (error) {
        console.error('Controller Error deleting message:', error);
        res.status(500).json({ success: false, message: 'Error deleting message' });
    }
};


const createBooking = async (req, res) => {
  try {
    const {
      customerName, email, cellPhone, homePhone, homeAddress, emergencyContactNumber,
      workPhone, petsName, petsAge, dailyRoutine, petsHealth, favoriteThings,
      idioSyncrasies, vetPermission, startDateAndTime, endDateAndTime, specialRequest,
      alarmInfo, miscNotes, additionalNotes,

      // New fields for travel itinerary
      departureDateTime, returnDateTime, destination, emergencyContactName,
      emergencyContactPhone, flightNumber, departureAirport, arrivalAirport
    } = req.body;

    const newBooking = new Booking({
      customerName, email, cellPhone, homePhone, homeAddress, emergencyContactNumber,
      workPhone, petsName, petsAge, dailyRoutine, petsHealth, favoriteThings,
      idioSyncrasies, vetPermission, startDateAndTime, endDateAndTime, specialRequest,
      alarmInfo, miscNotes, additionalNotes,

      // Travel itinerary data
      departureDateTime, returnDateTime, destination, emergencyContactName,
      emergencyContactPhone, flightNumber, departureAirport, arrivalAirport
    });

    await newBooking.save();



    res.status(200).json({ success: true, message: 'Booking successful!' });
  } catch (error) {
    console.error('Controller Error Saving Booking:', error);
    res.status(500).json({ success: false, message: 'Error Booking!' });
  }
};

const getBooking = async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 });
    console.log('Bookings from the MongoDb: ', bookings);
    res.status(200).json(bookings);
  } catch (error) {
    console.error('Error retrieving bookings:', error);
    res.status(500).json({ success: false, message: 'Error retrieving bookings' });
  }
};

const deleteABooking = async (req, res) => {
  try {
    console.log('Delete request received for ID:', req.params.id);
    const bookingId = req.params.id;
    const result = await Booking.findByIdAndDelete(bookingId);

    console.log('Booking Deleted: ', result);
    if (!result) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    res.status(200).json({ success: true, message: 'Booking deleted successfully' });
  } catch (error) {
    console.error('Controller Error deleting booking:', error);
    res.status(500).json({ success: false, message: 'Error deleting booking' });
  }
};

const updateBooking = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const updateData = req.body;

    const updatedBooking = await Booking.findByIdAndUpdate(bookingId, updateData, { new: true });

    if (!updatedBooking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    res.status(200).json({ success: true, message: 'Booking updated successfully', data: updatedBooking });
  } catch (error) {
    console.error('Controller Error updating booking:', error);
    res.status(500).json({ success: false, message: 'Error updating booking' });
  }
};

// 4. Controller Logic for Newsletter Subscriptions

const subscribeNewsletter = async (req, res) => {
    try {
        const { email } = req.body;

        const existingSubscriber = await Newsletter.findOne({ email });
        if (existingSubscriber) {
            return res.status(400).json({ success: false, message: 'Email is already subscribed' });
        }

        const newSubscriber = new Newsletter({ email });
        await newSubscriber.save();

        res.status(200).json({ success: true, message: 'Subscribed to newsletter successfully' });
    } catch (error) {
        console.error('Controller Error subscribing to newsletter:', error);
        res.status(500).json({ success: false, message: 'Error subscribing to newsletter' });
    }
};

// 5. Routes

// Messaging Routes
app.post('/messages/send', sendMessage);
app.get('/messages/all', getMessages);
app.delete('/messages/:id', deleteMessage);

// Booking Routes
app.post('/bookings/create', createBooking);
app.get('/bookings/getall', getBooking);
app.put('/bookings/update/:id', updateBooking);
app.delete('/bookings/delete/:id', deleteABooking);

// Newsletter Subscription Route
app.post('/subscribe', subscribeNewsletter);

app.get('/', (req, res) => {
  res.json('Welcome to Pamelas Pampered Pets API server!');
});


app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
});

// 6. Server Startup

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});