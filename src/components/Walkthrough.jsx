import React, { useState } from "react";
import { groupScopedKey } from "../lib/api/core.js";

// Used before anyone's signed in — there's no group/account yet to scope
// a key to, so this is a single, universal "have they seen the generic
// intro" flag, separate from the per-account key below.
export const PRE_LOGIN_SEEN_KEY = "chilimba:pre-login-intro-seen";

export function walkthroughSeenKey(session) {
  return groupScopedKey(session, "walkthrough-seen", session.name.toLowerCase());
}

export function hasSeenWalkthrough(session) {
  if (!session) return localStorage.getItem(PRE_LOGIN_SEEN_KEY) === "1";
  return localStorage.getItem(walkthroughSeenKey(session)) === "1";
}

function markWalkthroughSeen(session) {
  if (!session) {
    localStorage.setItem(PRE_LOGIN_SEEN_KEY, "1");
    return;
  }
  localStorage.setItem(walkthroughSeenKey(session), "1");
}

function buildSteps(session) {
  const isAdmin = session?.role === "admin";

  const steps = [
    {
      emoji: "🤝",
      title: "Welcome to your Chilimba",
      body: "A Chilimba is a rotating savings circle — everyone contributes on a shared schedule, and each date one or more members receive the payout. This app tracks who's paid, who's next, and where the money goes.",
    },
    {
      emoji: "📒",
      title: "My Payment History",
      body: "Tap \"Amount Paid\" on any date to log a payment or see its history. Tap \"Amount Due\" if your agreed rate is different from the group default — not everyone contributes the same amount. Nothing is ever overwritten; corrections happen by voiding an entry and logging a new one.",
    },
    {
      emoji: "💚",
      title: "Confirmed payments",
      body: "Every payment you log shows a small dot next to it: amber means it's waiting on an admin to check it (it won't count toward your balance yet), green means an admin has confirmed the money arrived, and red means it was rejected, with a reason shown.",
    },
    {
      emoji: "📱",
      title: "Where to Pay",
      body: "Your Payment History shows the mobile money or bank details your group's admin has set up — that's where your contribution actually goes.",
    },
    {
      emoji: "🔔",
      title: "Reminders",
      body: "Turn on push or SMS reminders so you get a nudge a few days before each due date.",
    },
    {
      emoji: "👥",
      title: "Community",
      body: "See the group's shared funds and overall totals. If anyone's borrowed from a fund that's open for borrowing, the amount and status are shown — names stay private.",
    },
    {
      emoji: "🧮",
      title: "Calculator",
      body: "Need to work out a number while you're in the app? Tap the calculator icon in the header any time — it's separate from your payment history totals.",
    },
  ];

  if (isAdmin) {
    steps.push({
      emoji: "⚙️",
      title: "Group Setup (you're an admin)",
      body: "Edit the payout schedule, community funds, and payment details here. The \"Members & Admins\" section shows every member, when they joined, and who's due next — and lets you promote, demote, or remove someone.",
    });
    steps.push({
      emoji: "📢",
      title: "Post a notice",
      body: "Anything the whole group needs to know? Post it from the notice board at the top of the dashboard — every member sees it.",
    });
  }

  steps.push({
    emoji: "✅",
    title: "That's it",
    body: "You can reopen this walkthrough any time from the ? icon in the header.",
  });

  return steps;
}

export default function Walkthrough({ session, onClose }) {
  const steps = buildSteps(session);
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const isLast = index === steps.length - 1;

  const finish = () => {
    markWalkthroughSeen(session);
    onClose();
  };

  const skip = () => {
    markWalkthroughSeen(session);
    onClose();
  };

  return (
    <div className="calc-modal-backdrop" onClick={skip}>
      <div className="walkthrough-modal" onClick={(e) => e.stopPropagation()}>
        <div className="walkthrough-dots">
          {steps.map((_, i) => (
            <span key={i} className={"walkthrough-dot" + (i === index ? " walkthrough-dot-active" : "")} />
          ))}
        </div>

        <div className="walkthrough-emoji">{step.emoji}</div>
        <h3 className="walkthrough-title">{step.title}</h3>
        <p className="walkthrough-body">{step.body}</p>

        <div className="walkthrough-controls">
          {!isLast && (
            <button className="btn-link" onClick={skip}>Skip</button>
          )}
          <div className="walkthrough-nav">
            {index > 0 && (
              <button className="btn-ghost-dark" onClick={() => setIndex(index - 1)}>Back</button>
            )}
            {isLast ? (
              <button className="btn-primary" style={{ width: "auto" }} onClick={finish}>Done</button>
            ) : (
              <button className="btn-primary" style={{ width: "auto" }} onClick={() => setIndex(index + 1)}>Next</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
