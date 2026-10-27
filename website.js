"use strict";

async function postDocument(resource, document) {
  const response = await fetch(`/api/${resource}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(document),
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || `Request failed (${response.status})`);
  }
  return result;
}

const bookingForm = document.getElementById("bookingForm");
if (bookingForm) {
  const bookingStatus = document.getElementById("bookingStatus");

  bookingForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    bookingStatus.className = "alert d-none";

    const formData = new FormData(bookingForm);
    const booking = {
      fullName: formData.get("fullName").trim(),
      email: formData.get("email").trim(),
      phone: formData.get("phone").trim(),
      destination: formData.get("destination").trim(),
      travelers: Number(formData.get("travelers")),
      startDate: formData.get("startDate"),
      endDate: formData.get("endDate"),
      requests: formData.get("requests").trim(),
      createdAt: new Date().toISOString(),
    };
    const submitButton = bookingForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
      const savedBooking = await postDocument("bookings", booking);
      bookingStatus.textContent = savedBooking.message ||
        "Your booking request was saved successfully.";
      bookingStatus.className = "alert alert-success";
      bookingForm.reset();
    } catch (error) {
      console.error("Unable to save booking:", error);
      bookingStatus.textContent = `Your booking could not be saved: ${error.message}`;
      bookingStatus.className = "alert alert-danger";
    } finally {
      submitButton.disabled = false;
    }
  });
}

const chatMessages = document.getElementById("chatMessages");
if (chatMessages) {
  const userInput = document.getElementById("userInput");
  const sendButton = document.getElementById("sendMessage");
  const responses = {
    tour: "We offer amazing tours including Serengeti Safari, Mount Kilimanjaro, and Zanzibar Beach Tours. Would you like more details about any specific tour?",
    booking: "You can book through our website at bookings.html or contact us at info@eastafricatourism.com. We also offer phone support!",
    price: "Our tour prices vary depending on duration and group size. Prices start from $500 for a 3-day tour. Contact us for custom quotes!",
    safari: "Our safari tours include guided game drives, camping, and all meals. Popular destinations are Serengeti, Masai Mara, and Amboseli. Interested?",
    kilimanjaro: "Mount Kilimanjaro trekking is available year-round with experienced guides. The trek takes 5-7 days depending on the route. Want details?",
    zanzibar: "Zanzibar offers beautiful beaches, Stone Town heritage, and water activities. We offer 4-5 day packages. Would you like to know more?",
    contact: "You can reach us at +256 706 980 717 or email info@eastafricatourism.com. We're available Monday-Friday, 9am-5pm EAT.",
    group: "We offer group discounts for parties of 10 or more. Contact us for customized group packages and special rates!",
    visa: "We can assist with travel documentation advice. Most visitors need a valid passport and may require visas. Check our About Us page for details.",
    accommodation: "We arrange accommodation ranging from budget lodges to luxury resorts. All tours include hotel arrangements. Tell us your preference!",
    thanks: "You're welcome! If you have any more questions, feel free to ask. Have a great day!",
    default: "You are most welcome! Come visit us once again if you need any assistance! For more specific information, please visit our website or call us at +256 706 980 717. Is there anything else I can help with?",
  };

  function getResponse(userMessage) {
    const message = userMessage.toLowerCase();
    if (message.includes("tour") || message.includes("package")) return responses.tour;
    if (message.includes("book")) return responses.booking;
    if (message.includes("price") || message.includes("cost") || message.includes("$")) return responses.price;
    if (message.includes("safari")) return responses.safari;
    if (message.includes("kilimanjaro") || message.includes("mountain")) return responses.kilimanjaro;
    if (message.includes("zanzibar") || message.includes("beach")) return responses.zanzibar;
    if (message.includes("contact") || message.includes("phone") || message.includes("email")) return responses.contact;
    if (message.includes("group") || message.includes("discount")) return responses.group;
    if (message.includes("visa") || message.includes("passport")) return responses.visa;
    if (message.includes("hotel") || message.includes("accommodation") || message.includes("stay")) return responses.accommodation;
    if (message.includes("thank")) return responses.thanks;
    return responses.default;
  }

  function addMessage(text, sender) {
    const message = document.createElement("div");
    message.className = `message ${sender === "user" ? "user-message" : ""}`;

    const bubble = document.createElement("div");
    bubble.className = `message-bubble ${sender === "user" ? "user-bubble" : "bot-bubble"}`;

    const textElement = document.createElement("p");
    textElement.className = "mb-0";
    textElement.textContent = text;

    const timestamp = document.createElement("div");
    timestamp.className = "timestamp";
    timestamp.textContent = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    bubble.append(textElement, timestamp);
    message.appendChild(bubble);
    chatMessages.appendChild(message);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  async function sendMessage() {
    const question = userInput.value.trim();
    if (!question || sendButton.disabled) return;

    addMessage(question, "user");
    userInput.value = "";
    sendButton.disabled = true;

    const typing = document.createElement("div");
    typing.className = "message";
    typing.id = "typingIndicator";
    typing.innerHTML = '<div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';
    chatMessages.appendChild(typing);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    const answer = getResponse(question);
    try {
      await postDocument("inquiries", {
        question,
        answer,
        createdAt: new Date().toISOString(),
      });
      addMessage(answer, "bot");
    } catch (error) {
      console.error("Unable to save inquiry:", error);
      addMessage("Sorry, your inquiry could not be saved. Please try again later.", "bot");
    } finally {
      typing.remove();
      sendButton.disabled = false;
      userInput.focus();
    }
  }

  document.querySelectorAll("[data-topic]").forEach((topic) => {
    topic.addEventListener("click", () => {
      userInput.value = topic.dataset.topic;
      userInput.focus();
    });
  });
  sendButton.addEventListener("click", sendMessage);
  userInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      sendMessage();
    }
  });
}
