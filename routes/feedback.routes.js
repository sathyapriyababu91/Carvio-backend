
const express = require('express');
const router = express.Router();

const Feedback = require('../model/feedback.model');
const { sendFeedbackEmail } = require('../services/email.service');

router.post('/', async (req, res) => {
  try {
    const { name, phone, category, message } = req.body;

    // Validate required fields
    if (
      typeof name !== 'string' ||
      typeof phone !== 'string' ||
      typeof category !== 'string' ||
      typeof message !== 'string' ||
      !name.trim() ||
      !phone.trim() ||
      !category.trim() ||
      !message.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: 'Please fill in all required fields.',
      });
    }

    // Validate phone number
    if (!/^[6-9]\d{9}$/.test(phone.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 10-digit mobile number.',
      });
    }

    // Save feedback to MongoDB first
    const feedback = await Feedback.create({
      name: name.trim(),
      phone: phone.trim(),
      category: category.trim(),
      message: message.trim(),
    });

    // Try sending email separately
    let emailSent = false;

    try {
      await sendFeedbackEmail({
        name: feedback.name,
        phone: feedback.phone,
        category: feedback.category,
        message: feedback.message,
      });

      emailSent = true;
    } catch (emailError) {
      console.error('FEEDBACK EMAIL ERROR:', emailError);
    }

    return res.status(201).json({
      success: true,
      message: emailSent
        ? 'Feedback saved and email notification sent.'
        : 'Feedback saved successfully. Email notification could not be sent.',
      feedbackId: feedback._id,
      emailSent,
    });
  } catch (error) {
    console.error('FEEDBACK SUBMISSION ERROR:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to save feedback. Please try again later.',
    });
  }
});

module.exports = router;
