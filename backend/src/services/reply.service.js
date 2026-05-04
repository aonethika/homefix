/**
 * Generates contextual chatbot replies based on state and intent
 */

const SERVICE_NAMES = {
  PLUMBER: 'plumber',
  ELECTRICIAN: 'electrician',
  AC_TECHNICIAN: 'AC technician',
  CARPENTER: 'carpenter',
};

const SERVICE_EMOJIS = {
  PLUMBER: '🔧',
  ELECTRICIAN: '⚡',
  AC_TECHNICIAN: '❄️',
  CARPENTER: '🪵',
};

export class ReplyService {
  greeting() {
    const greetings = [
      "Hi! I'm FixBot 🏠 — your smart home services assistant. What issue are you facing today?",
      "Hello! Need a home repair or service? Just describe the problem and I'll find the right professional for you! 🛠️",
      "Welcome to HomeFix! Tell me about the issue at home and I'll connect you with the right expert. 🏠",
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  serviceDetected(serviceType, description) {
    const name = SERVICE_NAMES[serviceType] || 'professional';
    const emoji = SERVICE_EMOJIS[serviceType] || '🔧';
    return `Got it! ${emoji} It sounds like you need a **${name}**.\n\nYou mentioned: *"${description}"*\n\nTo find the best professional near you, could you share your **location** or area? You can type your address or we can use your current location.`;
  }

  searching(serviceType) {
    const name = SERVICE_NAMES[serviceType] || 'professional';
    const emoji = SERVICE_EMOJIS[serviceType] || '🔧';
    return `🔍 Perfect! Searching for available ${emoji} **${name}s** near you...`;
  }

  workerFound(workerName, serviceType, distance) {
    const emoji = SERVICE_EMOJIS[serviceType] || '🔧';
    const distText = distance ? ` (~${distance.toFixed(1)} km away)` : '';
    return `Great news! I found **${workerName}**${distText} — a skilled ${emoji} ${SERVICE_NAMES[serviceType]}.\n\nThey've been notified and will respond shortly. You'll get a real-time update once they accept your request!`;
  }

  workerAssigned(workerName) {
  return `**${workerName}** has accepted your request and is on the way 🚀

  ⚠️ Please verify the worker's details before allowing entry.
  Need help? Contact support anytime.`;
  }

  workerRejected() {
    return `The assigned worker couldn't take this job. No worries — I'm searching for another available professional near you. Please wait a moment! 🔍`;
  }

  noWorkerFound(serviceType) {
    const name = SERVICE_NAMES[serviceType] || 'professional';
    return `😔 I couldn't find an available ${name} near you right now. Please try again in a few minutes, or I can notify you when one becomes available!`;
  }

  priceProposed(workerName, price) {
    return `💰 **${workerName}** has completed the job and is requesting **₹${price.toFixed(2)}** for the service.\n\nWould you like to **approve** this amount and proceed to payment? Reply **Yes** to approve or **No** if you'd like to discuss.`;
  }

  paymentPending(amount, orderId) {
    return `✅ Price approved! Your payment of **₹${amount.toFixed(2)}** is ready to process.\n\nClick the **Pay Now** button below to complete payment via Razorpay. 💳`;
  }

  paymentCompleted(amount) {
    return `🎊 Payment of **₹${amount.toFixed(2)}** received successfully! Thank you for using HomeFix.\n\nHow was your experience? Please take a moment to **rate your service professional** — your feedback helps us maintain quality! ⭐`;
  }

  cancelled() {
    return `Your service request has been cancelled. Is there anything else I can help you with? 😊`;
  }

  askForMoreDetail() {
    const prompts = [
      "Could you describe the issue in a bit more detail? For example, where in your home is the problem, and when did it start?",
      "I'd love to help! Can you give me more details about the problem you're experiencing?",
      "To find the right professional, could you describe what's happening? Any extra detail helps!",
    ];
    return prompts[Math.floor(Math.random() * prompts.length)];
  }

  workerArriving(workerName) {
  return `🚗 **${workerName}** is on the way!

⚠️ For safety, ensure you verify the worker before letting them in.`;
}

  jobInProgress(workerName) {
    return `🔨 **${workerName}** has started working on your issue. You'll be notified once the job is complete!`;
  }

 
  unknown() {
    return `I'm here to help with home services like plumbing, electrical, AC, and carpentry. Please describe your home issue and I'll find the right professional! 🏠`;
  }
}
