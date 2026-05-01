import { useState } from "react";
import "./FAQ.css";

const FAQ_ITEMS = [
  {
    q: "How do I get crop recommendations?",
    a: "Navigate to the Advisor section and enter your soil type, location, and season. Our AI will suggest the best crops for you."
  },
  {
    q: <span>Is <span className="notranslate" translate="no">Fasal Saathi</span> available in my language?</span>,
    a: "Yes! We support 12 Indian languages including Hindi, Bengali, Tamil, Telugu, Marathi, and more. Use the language selector in the navbar."
  },
  {
    q: "How accurate are the weather forecasts?",
    a: "We use real-time data from trusted meteorological sources to provide forecasts accurate up to 7 days for your location."
  },
  {
    q: <span>Can I use <span className="notranslate" translate="no">Fasal Saathi</span> offline?</span>,
    a: "Yes, basic features work offline. Your data syncs automatically when you reconnect to the internet."
  },
  {
    q: "How do I report a bug or issue?",
    a: "Use this contact form with the subject 'Bug Report', or visit our Community page to post in the support thread. Our team responds within 24 hours."
  },
];

export default function FAQ() {
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <div className="faq-page">
      <div className="faq-header">
        <h1><span className="notranslate">Frequently Asked Questions</span></h1>
        <p className="faq-subtitle">Quick answers to common questions about <span className="notranslate" translate="no">Fasal Saathi</span>.</p>
      </div>
      <div className="faq-list">
        {FAQ_ITEMS.map((item, i) => (
          <div key={i} className={`faq-item ${openFaq === i ? "open" : ""}`}>
            <button className="faq-question" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
              <span className="faq-num">0{i + 1}</span>
              <span>{item.q}</span>
              <span className="faq-chevron">{openFaq === i ? "−" : "+"}</span>
            </button>
            <div className="faq-answer-wrap">
              <div className="faq-answer">{item.a}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}