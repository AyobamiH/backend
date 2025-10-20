//  ✅ 1. Importing core libraries & dependencies
import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import session from "express-session";
import MongoStore from "connect-mongo";
import cors from "cors";
import path from "path";
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import methodOverride from "method-override";
import passport from "passport";
import Stripe from "stripe";
import { fileURLToPath } from "url";
import axios from 'axios';
import { runNextdoorScraper } from './services/nextdoorScraper.js';

// Simulate __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();


// Initialize Stripe with the secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ✅ 2. Setup app and port

const app = express();

// ✅ 3. Middleware Setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin:  [
      'https://tailwaggingwebdesign.app.n8n.cloud',
      'https://tailwaggingwebdesign.com', 
      'https://websites-design-factory-on-the-web.com', 
      'https://websites-design-factory-on-the-web.co.uk', 
      'https://web-design-factory-of-the-web.com',
      'https://hellopamela.com',
      'https://pamelas-pampered-pets-website-git-pre-757e52-ayobamihs-projects.vercel.app/'
      
    ], // Your frontend domain
    methods: ["POST", "GET", "DELETE", "PUT"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
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

// ✅ 4. Cloudinary Configuration (Image Uploads)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});


// ✅ 5. Multer + CloudinaryStorage Setup

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'pet_reviews',
    allowed_formats: ['jpg', 'jpeg', 'png'],
  },
});

const upload = multer({ storage });


// Initialize Passport.js
app.use(passport.initialize());
app.use(passport.session());

// ✅ 6. Review Mongoose Schema Definition

const reviewSchema = new mongoose.Schema({
    name: String,
    pet: String,
    rating: String,
    review: String,
    consent: Boolean,
    photoUrl: String,
    status: String,
    photoId: String, // ← Add this
  }, { timestamps: true });
  

const Review = mongoose.model('Review', reviewSchema);


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

const onboardingSchema = new mongoose.Schema({
  businessName:       { type: String, required: true },
  bookingVolume:      { type: String, required: true },
  painPoints:         { type: [String], required: true },
  priorityAutomation: { type: String, required: true },
  bookingMethod:      { type: String, required: true },
  takesDeposits:      { type: String, required: true },
  followUpMethod:     { type: String, required: true },
  toolsUsed:          { type: [String], required: true },
  techComfort:        { type: String, required: true },
  desiredPerks:       { type: [String], required: true },
  email:              { type: String, required: true },
}, { timestamps: true });

const Onboarding = mongoose.model('Onboarding', onboardingSchema)

const bookingSchema = new mongoose.Schema({

// Customer Information
customerName: String,
email: String,
cellPhone: String,
homePhone: String,
homeAddress: String,
emergencyContactNumber: String,
workPhone: String,

// Pet Information
petsName: String,
petsAge: String,
dailyRoutine: String,
petsHealth: String,
favoriteThings: String,
idioSyncrasies: String,
vetPermission: Boolean,
emergencyVetsName: String,
emergencyVetsNumber: String,
vetsName: String,
vetsPhone: String,
vetsAddress: String,

// Sitting Information
startDateAndTime: Date,
endDateAndTime: Date,
specialRequest: String,
alarmInfo: String,
miscNotes: String,
additionalNotes: String,

// New fields for travel itinerary
departureDateTime: Date,
returnDateTime: Date,
departureAirport: String,
departureFlightNumber: String,
destination: String,
arrivalAirport: String,
arrivalFlightNumber: String,
emergencyContactName: String,
emergencyContactPhone: String,



}, { timestamps: true });

const Booking = mongoose.model('Booking', bookingSchema);

// MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("MongoDB Connected");
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });


// Submit Review with experience-based moderation logic
app.post('/api/reviews', upload.single('photo'), async (req, res) => {
  try {
    const { name, pet, rating, review, consent } = req.body;
    const photoUrl = req.file?.path || '';

    // Only 'Absolutely Loved It!' = auto-approved
    const status = rating === 'Absolutely Loved It!' || 'Very Happy' ? 'approved' : 'pending';

    console.log(status)
    const newReview = new Review({
      name,
      pet,
      rating,
      review,
      consent,
      photoUrl,
      status,
    });

    await newReview.save();

    const message = status === 'approved'
      ? 'Review submitted successfully!'
      : 'Thank you! Your review is pending moderation and will be reviewed shortly.';

    res.status(201).json({ message, review: newReview });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// Get only approved reviews
app.get('/api/reviews', async (req, res) => {
  try {
    const reviews = await Review.find({status: 'approved'}).sort({ createdAt: -1 });
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Update review (e.g. approve manually)
app.put('/api/reviews/:id', async (req, res) => {
  try {
    const updated = await Review.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update review' });
  }
});

// Delete review
app.delete('/api/reviews/:id', async (req, res) => {
  try {
    const deleted = await Review.findByIdAndDelete(req.params.id);
    res.json({ message: 'Review deleted', deleted });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete review' });
  }
});



const BOOKING_N8N_WEBHOOK_URL = process.env.BOOKING_N8N_WEBHOOK_URL;
// console.log(BOOKING_N8N_WEBHOOK_URL)
const createBooking = async (req, res) => {
  try {
    // 1) Save booking in Mongo (Booking is already defined above)
    // console.log(req.body)
    const newBooking = await Booking.create(req.body);
     const origin = `${req.protocol}://${req.get('host')}`;
   
    const FE_URL = process.env.FRONTEND_URL;  // e.g. https://app.yourdomain.com

    // 3) Build payload
    const payload = {
      ...newBooking.toObject(),

      // images stay on your backend
      ad1_img:    `${FE_URL}/ads/bookingReminder.webp` || `${origin}/ads/bookingReminder.webp`,
      ad2_img:    `${FE_URL}/ads/gpsCheckinOut.webp` || `${origin}/ads/gpsCheckinOut.webp`,
      adMain_img: `${FE_URL}/ads/overviewBanner.png` || `${origin}/ads/overviewBanner.png`,
      ad3_img:    `${FE_URL}/ads/invoicePayment.png` || `${origin}/ads/invoicePayment.png`,
      ad4_img:    `${FE_URL}/ads/dailyReport.png` || `${origin}/ads/dailyReport.png`,
      logo_img: `${FE_URL}/ads/email_logo.webp`|| `${origin}/ads/email_logo.webp`,
      premiumDashboard_img: `${FE_URL}/ads/premiumDashboard.webp` || `${origin}/ads/dailyReport.png`,
      // URLs now point at your frontend docs
      ad1_url:    `https://automation.tailwaggingwebdesign.com/#booking-reminder-workflow`,
      ad2_url:    `https://automation.tailwaggingwebdesign.com/#gps-checkin-workflow`,
      adMain_url: `https://automation.tailwaggingwebdesign.com`,          // or whatever route you mount
      ad3_url:    `https://automation.tailwaggingwebdesign.com/#invoice-payment-workflow`,
      ad4_url:    `https://automation.tailwaggingwebdesign.com/#daily-report-workflow`,
    };
    axios.post(BOOKING_N8N_WEBHOOK_URL, payload, { timeout: 5000 })
      .catch(err => console.error('n8n webhook error:', err.message));

    // 3) Respond immediately
    return res
      .status(201)
      .json({ success: true, message: 'Booking successful!', data: newBooking });
  } catch (error) {
    console.error('Controller Error Saving Booking:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Error Booking!' });
  }
};
// --------------- UPDATED createBooking END ---------------
const getBooking = async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 });
    // console.log('Bookings from the MongoDb: ', bookings);
    res.status(200).json(bookings);
  } catch (error) {
    // console.error('Error retrieving bookings:', error);
    res.status(500).json({ success: false, message: 'Error retrieving bookings' });
  }
};

const deleteABooking = async (req, res) => {
  try {
    // console.log('Delete request received for ID:', req.params.id);
    const bookingId = req.params.id;
    const result = await Booking.findByIdAndDelete(bookingId);

    // console.log('Booking Deleted: ', result);
    if (!result) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    res.status(200).json({ success: true, message: 'Booking deleted successfully' });
  } catch (error) {
    // console.error('Controller Error deleting booking:', error);
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

// End of all Booking Controllers

// Beginning of Onboarding Controller

const ONBOARDING_WEBHOOK = process.env.ONBOARDING_N8N_WEBHOOK_URL;

const createOnboarding =  async (req, res) => {
  try {
    // Save to Mongo
    const record = await Onboarding.create(req.body);

    // Fire off the webhook asynchronously
    axios.post(ONBOARDING_WEBHOOK, {
      ...record.toObject(),
      source:    'elite_sitter_onboarding',
      timestamp: new Date().toISOString(),
    }).catch(err => console.error('n8n webhook error:', err.message));

    // Return success
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    console.error('Onboarding error:', err);
    res.status(500).json({
      success: false,
      error:   'Failed to submit onboarding. Please try again later.'
    });
  }
}
// Start of send message controllers for pamela 
// --------------- UPDATED sendMessage START ---------------
const N8N_MESSAGE_WEBHOOK_URL = 'https://tailwaggingwebdesign.app.n8n.cloud/webhook/messages/send';

const sendMessage = async (req, res) => {
  try {
    // 1) Save message in Mongo
    const { name, email, phone, message, agreement } = req.body;
    const newMessage = await Message.create({ name, email, phone, message, agreement });

    // 2) Fire off the n8n webhook asynchronously
    axios.post(N8N_MESSAGE_WEBHOOK_URL, newMessage.toObject(), { timeout: 5000 })
      .catch(err => console.error('n8n webhook error:', err.message));

    // 3) Respond immediately
    return res
      .status(200)
      .json({ success: true, message: 'Message sent successfully and notification delivered', data: newMessage });
  } catch (error) {
    console.error('Controller Error saving message:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Error sending message' });
  }
};
// --------------- UPDATED sendMessage END ---------------


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

// End of mesage controllers for pamela
// Tail wagging websites design factory controllers

app.post("/create-buy-plan-session", async (req, res) => {
  try {
    console.log(req.body)
    const { planName, planPrice, onboardingFee } = req.body;

    if (!planName || !planPrice || onboardingFee === undefined) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    const numericPrice = parseFloat(planPrice.toString().replace(/[^0-9.]/g, ""));
    const numericOnboardingFee = parseFloat(onboardingFee.toString().replace(/[^0-9.]/g, ""));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: { name: planName },
            unit_amount: Math.round(parseFloat(planPrice) * 100),
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: "gbp",
            product_data: { name: "Onboarding Fee" },
            unit_amount: Math.round(parseFloat(onboardingFee) * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.origin}/pass/stripe/{CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/cancel`,
      metadata: {
        planName,
        planPrice: numericPrice,
        onboardingFee: numericOnboardingFee,
        
      },
    });
    
    console.log("Stripe session created with metadata:", session.metadata);

    res.json({ url: session.url });
  } catch (error) {
    console.error("Error creating Stripe session:", error);
    res.status(500).json({ message: "Failed to create checkout session" });
  }
});


app.get("/pass/stripe/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;

    console.log("Fetching session with ID:", sessionId);

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    console.log("Retrieved Stripe Session:", session);

    if (!session.metadata) {
      console.error("Metadata from pass route is missing:", session.metadata);
      return res.status(400).json({ message: "Metadata or Questionnaire ID missing in session" });
    }

    const result = {
      id: session.id,
      paymentStatus: session.payment_status,
      amountTotal: session.amount_total / 100, // Convert to pounds
      currency: session.currency.toUpperCase(),
      planName: session.metadata.planName,
      onboardingFee: session.metadata.onboardingFee,
      firstInstallment: session.metadata.firstInstallment,
      
    };

    console.log("Returning Session Data:", result);

    res.json(result);
  } catch (error) {
    console.error("Error retrieving Stripe session:", error);
    res.status(500).json({ message: "Error retrieving session data" });
  }
});

app.post("/create-checkout-session", async (req, res) => {

  try {
    const { planName, planPrice, questionnaireId, onboardingFee } = req.body;

    if (!planName || !planPrice || !questionnaireId || onboardingFee === undefined) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const numericPrice = parseFloat(planPrice.toString().replace(/[^0-9.]/g, ""));
    const numericOnboardingFee = parseFloat(onboardingFee.toString().replace(/[^0-9.]/g, ""));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: { name: planName },
            unit_amount: Math.round(numericPrice * 100),
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: "gbp",
            product_data: { name: "Onboarding Fee" },
            unit_amount: Math.round(numericOnboardingFee * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.origin}/success/stripe/{CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/cancel`,
      metadata: {
        questionnaireId,
        planName,
        onboardingFee: numericOnboardingFee,
        firstInstallment: numericPrice,
      },
    });

    console.log("Stripe session created with metadata:", session.metadata);

    return res.json({ url: session.url });
  } catch (error) {
    console.error("Error creating Stripe session:", error);
    res.status(500).json({ message: "Error creating checkout session" });
  }
});

app.get("/success/stripe/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;

    console.log("Fetching session with ID:", sessionId);

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    console.log("Retrieved Stripe Session:", session);

    if (!session.metadata || !session.metadata.questionnaireId) {
      console.error("Metadata is missing:", session.metadata);
      return res.status(400).json({ message: "Metadata or Questionnaire ID missing in session" });
    }

    const result = {
      id: session.id,
      paymentStatus: session.payment_status,
      amountTotal: session.amount_total / 100, // Convert to pounds
      currency: session.currency.toUpperCase(),
      planName: session.metadata.planName,
      onboardingFee: session.metadata.onboardingFee,
      firstInstallment: session.metadata.firstInstallment,
      questionnaireId: session.metadata.questionnaireId,
    };

    console.log("Returning Session Data:", result);

    res.json(result);
  } catch (error) {
    console.error("Error retrieving Stripe session:", error);
    res.status(500).json({ message: "Error retrieving session data" });
  }
});


// Beginning of Questionnaire
// Schemas
const QuestionnaireResponseSchema = new mongoose.Schema(
  {
    servicesOffered: [String],
    businessName: String,
    uniqueSellingPoints: String,
    idealClients: [String],
    primaryPetsServed: [String],
    targetAudienceDescription: String,
    primaryWebsiteGoal: [String],
    secondaryWebsiteGoal: [String],
    haveExistingWebsite: {
      type: String,
      enum: ['Yes', 'No'],
      get: (val) => val === 'Yes' || val === true, // Convert to boolean
      set: (val) => (val ? 'Yes' : 'No'), // Convert to 'Yes' or 'No'
    },
    budgetRange: String,
    desiredCustomerFeelings: [String],
    importantUserInteractions: [String],
    websiteStyle: [String],
    preferredImagery: [String],
    mustHaveFeatures: [String],
    needEcommerce: {
      type: String,
      enum: ['Yes', 'No'],
      get: (val) => val === 'Yes' || val === true,
      set: (val) => (val ? 'Yes' : 'No'),
    },
    includeBlogOrNewsletter: {
      type: String,
      enum: ['Yes', 'No'],
      get: (val) => val === 'Yes' || val === true,
      set: (val) => (val ? 'Yes' : 'No'),
    },
    websiteUpdateFrequency: [String],
    includePetResources: {
      type: String,
      enum: ['Yes', 'No'],
      get: (val) => val === 'Yes' || val === true,
      set: (val) => (val ? 'Yes' : 'No'),
    },
    desiredVisitorActions: [String],
    ctaPlacement: [String],
    admiredCompetitorWebsites: String,
    haveLogoAndBranding: {
      type: String,
      enum: ['Yes', 'No'],
      get: (val) => val === 'Yes' || val === true,
      set: (val) => (val ? 'Yes' : 'No'),
    },
    preferredColorSchemes: [String],
    mobileOptimizationImportance: String,
    anticipateServiceExpansion: {
      type: String,
      enum: ['Yes', 'No'],
      get: (val) => val === 'Yes' || val === true,
      set: (val) => (val ? 'Yes' : 'No'),
    },
    needWebsiteFlexibility: {
      type: String,
      enum: ['Yes', 'No'],
      get: (val) => val === 'Yes' || val === true,
      set: (val) => (val ? 'Yes' : 'No'),
    },
    interestedInSEO: {
      type: String,
      enum: ['Yes', 'No'],
      get: (val) => val === 'Yes' || val === true,
      set: (val) => (val ? 'Yes' : 'No'),
    },
    interestedInAnalytics: {
      type: String,
      enum: ['Yes', 'No'],
      get: (val) => val === 'Yes' || val === true,
      set: (val) => (val ? 'Yes' : 'No'),
    },
    email: {
      type: String,
      required: true,
    },
    phone: String,
    agreeToCommunications: {
      type: String,
      enum: ['Yes', 'No'],
      get: (val) => val === 'Yes' || val === true,
      set: (val) => (val ? 'Yes' : 'No'),
    },
     // New Fields for Recommendations
    recommendedStyle: String,
    featureList: [String],
    suggestedPackage: {
      name: String,
      features: [String],
    },
  
  },
  {
    timestamps: true,
    toJSON: { getters: true }, // Apply getters during JSON conversion
    toObject: { getters: true },
  }
);

const QuestionnaireResponse = mongoose.model(
  "QuestionnaireResponse",
  QuestionnaireResponseSchema
);


const createQuestionnaireResponse = async (req, res) => {

  console.log('Request body:', req.body); // Log request data
 try {
   const data = req.body;

   // Validate required fields
   if (!data.email || !data.budgetRange) {
     return res
       .status(400)
       .json({ success: false, message: 'Email and budget range are required.' });
   }

    // Derive recommendations based on user's answers
   let recommendedStyle = 'Modern'; // Default recommended style
   let featureList = [];
   let suggestedPackage = {
     name: 'Basic',
     features: [
       'Responsive Design: Works across all devices',
       'Mobile Friendly: Optimized for mobile users',
       'Basic SEO Setup: Simple keyword and on-page optimization',
       'User-friendly Navigation: Easy for visitors to navigate',
       'Integration with Basic Booking System: Simple calendar or form',
     ],
   };

   // Logic to derive recommendedStyle
    // Logic to derive recommendedStyle
   if (data.websiteStyle) {
     if (data.websiteStyle.includes('Elegant')) {
       recommendedStyle = 'Elegant';
     } else if (data.websiteStyle.includes('Playful')) {
       recommendedStyle = 'Playful';
     } else if (data.websiteStyle.includes('Minimalist')) {
       recommendedStyle = 'Minimalist';
     }else if (data.websiteStyle.includes('Colorful')) {
       recommendedStyle = 'Colorful';
     }
   }

   // Logic to derive featureList from all possible options
   // Logic to derive featureList from all possible options
   if (data.needEcommerce) {
     featureList.push('E-Commerce Integration');
   }
   if (data.includeBlogOrNewsletter) {
     featureList.push('Blog & Newsletter');
   }
   if (data.primaryWebsiteGoal && data.primaryWebsiteGoal.includes('Allow online booking')) {
     featureList.push('Online Booking System');
   }
   if (data.mustHaveFeatures && data.mustHaveFeatures.includes('Service gallery')) {
     featureList.push('Service Gallery');
   }
   if (data.includePetResources) {
     featureList.push('Pet Resources Section');
   }
   if (data.interestedInSEO) {
     featureList.push('SEO Optimization');
   }
   if (data.interestedInAnalytics) {
     featureList.push('Analytics Integration');
   }
   if (data.importantUserInteractions && data.importantUserInteractions.includes('Contact form')) {
     featureList.push('Contact Form');
   }
   if (data.importantUserInteractions && data.importantUserInteractions.includes('Online booking system')) {
     featureList.push('Advanced Booking System');
   }
   if (data.websiteUpdateFrequency && data.websiteUpdateFrequency.includes('Monthly blog posts')) {
     featureList.push('Monthly Blog Updates');
   }
   if (data.anticipateServiceExpansion) {
     featureList.push('Scalable Infrastructure');
   }

   // Logic to determine suggestedPackage based on complexity
   if (data.budgetRange === '>£5000' || featureList.length > 6) {
     suggestedPackage = {
       name: 'Enterprise',
       price: '£198.99', // Added price
       features: [
         'Custom Design & Branding: Fully customized to your branding',
         'Full SEO Optimization: Includes Local SEO and keyword research',
         'Advanced Site Performance Improvements',
         'Flawless Mobile Responsiveness',
         'Full-scale Security Updates',
         'Web Accessibility Enhancements',
         'Regular Maintenance & Post-launch Support',
         'Advanced Booking Systems: Notifications & reminders',
       ],
     };
     } else if (data.budgetRange === '£2000 - £5000' || featureList.length > 3) {
       suggestedPackage = {
         name: 'Professional',
         price: '£128.79', // Added price
         features: [
           'Custom Design: Fully tailored to your brand and business',
           'Mobile Optimization: Advanced responsiveness',
           'Advanced SEO Setup: Keyword optimization and metadata',
           'Improved Site Performance and Speed',
           'Organized Content Restructuring',
           'Basic Security Updates',
           'Booking System Integration',
         ],
       };
     } else {
       suggestedPackage = {
         name: 'Basic',
         price: '£79.99', // Added price
         features: [
           'Responsive Design: Works across all devices',
           'Mobile Friendly: Optimized for mobile users',
           'Basic SEO Setup: Simple keyword and on-page optimization',
           'User-friendly Navigation: Easy for visitors to navigate',
           'Integration with Basic Booking System: Simple calendar or form',
         ],
       };
     }

   // Create new questionnaire response with derived fields
   const newResponse = new QuestionnaireResponse({
     ...data,
     recommendedStyle,
     featureList,
     suggestedPackage,
   });

 
   const savedResponse = await newResponse.save(); // Save and get the generated ID

   // Respond with the ID
   res.status(200).json({ 
     success: true, 
     message: 'Questionnaire submitted successfully!', 
     id: savedResponse._id // This ID is only available after save
   });


 } catch (error) {
   console.error('Error Saving Questionnaire Response:', error);
   res.status(500).json({ success: false, message: 'Error submitting questionnaire!' });
 }
};

 const scrapeNextDoorController =  async (req, res) => {
  try {
    const result = await runNextdoorScraper();
    res.status(200).json({
      message: 'Scraper ran successfully!',
      matches: result,
    });
  } catch (err) {
    console.error('❌ Scraper error:', err);
    res.status(500).json({ error: 'Scraper failed to run.' });
  }
};

// Scraping Route

app.get('/run-scraper', scrapeNextDoorController);

// Messaging Routes
app.post('/messages/send', sendMessage);
app.get('/messages/all', getMessages);
app.delete('/messages/:id', deleteMessage);

// Booking Routes
app.post('/bookings/create', createBooking);
app.get('/bookings/getall', getBooking);
app.put('/bookings/update/:id', updateBooking);
app.delete('/bookings/delete/:id', deleteABooking);

// Onboarding Route

app.post('/api/onboarding', createOnboarding);

// Questionnaire Route
app.post("/questionnaire/create", createQuestionnaireResponse);
app.get('/questionnaire/:id', async (req, res) => {
 try {
   const responseId = req.params.id;
   const questionnaire = await QuestionnaireResponse.findById(responseId);
   if (!questionnaire) {
     return res.status(404).json({ success: false, message: 'Questionnaire not found' });
   }
   res.status(200).json(questionnaire);
 } catch (error) {
   console.error('Error fetching questionnaire:', error);
   res.status(500).json({ success: false, message: 'Error fetching questionnaire' });
 }
});
app.get("/", (req, res) => {
 res.json("Welcome to The Questionnaire API server!");
});
app.get('/questionnaire/getall', async (req, res) => {
 try {
   const responses = await QuestionnaireResponse.find().sort({ createdAt: -1 });
   res.status(200).json(responses);
 } catch (error) {
   console.error('Error retrieving questionnaire responses:', error);
   res
     .status(500)
     .json({ success: false, message: 'Error retrieving questionnaire responses' });
 }
});

// End of 

// Fetch a specific questionnaire by ID


app.delete('/questionnaire/delete/:id', async (req, res) => {
 try {
   const responseId = req.params.id;
   const result = await QuestionnaireResponse.findByIdAndDelete(responseId);
   if (!result) {
     return res.status(404).json({ success: false, message: 'Questionnaire response not found' });
   }
   res
     .status(200)
     .json({ success: true, message: 'Questionnaire response deleted successfully' });
 } catch (error) {
   console.error('Error deleting questionnaire response:', error);
   res.status(500).json({ success: false, message: 'Error deleting questionnaire response' });
 }
});



// Static Files (Frontend)
app.use(express.static(path.join(__dirname, "dist")));

app.get("*", (req, res) => {
  res.sendFile(path.resolve(__dirname, "dist", "index.html"));
});


// Route: Get Single Blog Post by Slug
app.get("/api/blog-posts/:slug", async (req, res) => {
  const { slug } = req.params;

  try {
    const data = await client.request(GET_BLOG_POST, { slug });
    res.json(data.blogPost);
  } catch (error) {
    console.error("Error fetching blog post:", error);
    res.status(500).json({ error: "Failed to fetch blog post" });
  }
});

// Server Startup
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});


