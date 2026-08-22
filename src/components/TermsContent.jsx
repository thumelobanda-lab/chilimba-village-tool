import React, { useEffect, useState } from "react";
import { getSupportContact } from "../lib/api.js";

export const TERMS_VERSION = "2026-08-21";

/**
 * The actual Terms & Conditions text — rendered both inside TermsModal.jsx
 * (the sign-up gate and the "My Account" permanent link both open the
 * same modal, so there's exactly one copy of this text, never two that
 * could drift) and reachable from Profile.jsx after signup.
 *
 * NOT REVIEWED BY A LAWYER — see the notice at the top of the document
 * itself, and the equivalent flag in TermsModal.jsx / the PR description
 * this shipped with. Written from PRIVACY.md's existing data-handling
 * commitments plus the shape of what this app actually does and doesn't
 * do; it is not a substitute for real legal review before this reaches
 * paying users.
 */
export default function TermsContent() {
  const [contact, setContact] = useState({ supportEmail: null, supportWhatsapp: null });

  useEffect(() => {
    getSupportContact()
      .then(setContact)
      .catch(() => {}); // non-critical — the document still reads fine without it
  }, []);

  const contactLine = [contact.supportEmail, contact.supportWhatsapp ? `WhatsApp ${contact.supportWhatsapp}` : null]
    .filter(Boolean)
    .join(" or ");

  return (
    <div className="terms-content">
      <div className="terms-legal-warning">
        ⚠️ <strong>This is not legal advice.</strong> These terms were written for a small
        community savings tool and have <strong>not been reviewed by a lawyer</strong>. If
        you're relying on this document for real users and real money, have it reviewed by
        a qualified lawyer in your jurisdiction before launch — see "A note on this
        document" at the end.
      </div>

      <p className="muted tiny">Last updated: {TERMS_VERSION}</p>

      <h3 className="panel-subtitle">1. What Chilimba Circle Is</h3>
      <p className="small">
        Chilimba Circle is a record-keeping and coordination tool for a Chilimba — a
        rotating savings circle, sometimes called a stokvel or merry-go-round. It helps a
        group track who has paid, whose turn it is to receive the next payout, and how much
        a shared community fund holds.
      </p>

      <h3 className="panel-subtitle">2. This App Does Not Hold or Move Money</h3>
      <p className="small">
        This is the single most important thing to understand about Chilimba Circle:{" "}
        <strong>the app never holds, transfers, or guarantees any money.</strong> Every
        contribution and every payout happens directly between members — by cash, mobile
        money, bank transfer, or however your group has agreed — entirely outside this app.
        Chilimba Circle only records what members and admins report. It does not verify
        that a reported payment actually took place, does not act as an escrow or payment
        processor, and is not a bank, lender, or financial institution. If a member reports
        a payment that never happened, or an admin confirms one in error or in bad faith,
        the app has no way to detect or reverse that on its own — the record only reflects
        what was entered, and disputes are resolved between members, with the process in
        Section 6 below.
      </p>

      <h3 className="panel-subtitle">3. Data We Collect</h3>
      <p className="small">
        We collect your full name, phone number, and a PIN when you sign up. Your PIN is
        never stored or transmitted in plain text — only a one-way PBKDF2-SHA256 hash
        (100,000 iterations, a unique random value per account) is kept, which can verify a
        future login but can never be reversed back into your actual PIN, even by us. Your
        phone number is never shown to other members; it exists so you can sign in with it
        and so a future PIN-reset option is possible. Your name is visible to other members
        of your own group (the payout schedule is inherently shared), but your individual
        payment history and balance are visible only to you and your group's admins — never
        to another regular member, and never to a different group entirely. If your group
        enables a mobile money subscription payment, the full number is only used for that
        one request; only the last 3 digits are kept afterward. Full technical detail on
        what's collected, who can see it, and how it's secured is in this project's{" "}
        <a
          href="https://github.com/thumelobanda-lab/chilimba-village-tool/blob/main/PRIVACY.md"
          target="_blank"
          rel="noopener noreferrer"
        >
          Privacy &amp; Security documentation
        </a>.
      </p>

      <h3 className="panel-subtitle">4. Your Responsibilities</h3>
      <ul className="small">
        <li>Give accurate information when you sign up, and keep your PIN private — anyone who has it can act as you.</li>
        <li>Report payments honestly. Logging a payment that didn't happen, or an amount that's wrong, misleads the rest of your group about real money that's already changed hands outside the app.</li>
        <li>Understand that a member-submitted payment sits as pending until your group's admin confirms it — it isn't verified just because it's been entered.</li>
        <li>Treat other members' information (names, contribution status) as something to keep within your group, not to share elsewhere.</li>
      </ul>

      <h3 className="panel-subtitle">5. Admin Responsibilities</h3>
      <p className="small">
        A group's admin(s) confirm or reject payments, manage the payout schedule, and can
        promote, demote, or remove members of their own group. This is a position of trust:
        confirming a payment is a signal to the rest of the group that the money has
        genuinely been checked and arrived, and getting the schedule and due amounts right
        is what everyone else relies on to know what they owe. An admin should only confirm
        a payment they've actually verified (e.g. checked a mobile money statement or
        deposit slip), should keep the group's schedule accurate, and should not remove or
        demote another member to settle a personal disagreement rather than a genuine
        administrative reason.
      </p>

      <h3 className="panel-subtitle">6. Disputes &amp; Complaints</h3>
      <p className="small">
        If you believe a payment record is wrong, think an admin has acted unfairly, or want
        to raise a concern about another member,{" "}
        {contactLine ? (
          <>contact us at <strong>{contactLine}</strong>.</>
        ) : (
          <>contact your group's admin first, or reach out to Chilimba Circle directly (contact details are configured by the platform owner).</>
        )}{" "}
        We may mark a complaint as under review and follow up with you through an in-app
        message — you'll see it as a notice the next time you open the app. Chilimba Circle
        can look into a complaint and, where appropriate, act on a group's access (Section
        7), but — per Section 2 — cannot recover money that was exchanged outside the app,
        since it was never in the app's possession to begin with.
      </p>

      <h3 className="panel-subtitle">7. Account Suspension &amp; Fraud Policy</h3>
      <p className="small">
        Chilimba Circle's platform owner may suspend a group's access — meaning every member
        of that group is signed out and can't sign back in — if we detect activity that
        looks fraudulent or abusive, or that goes against these terms. Suspension is not
        permanent by default and no data is deleted when it happens; everything is restored
        once the situation is resolved. Where practical, we'll send an in-app notice
        explaining the reason before or at the time of suspension, with a way to reach us
        and appeal or resolve it
        {contactLine ? <> — {contactLine}</> : ""}. We aim for suspension to be a last
        resort after a warning, not a first response, except where we believe waiting would
        cause further harm.
      </p>

      <h3 className="panel-subtitle">8. Changes to These Terms</h3>
      <p className="small">
        We may update these terms as the app changes. Continuing to use Chilimba Circle
        after an update means you accept the current version, which is always reachable
        from My Account.
      </p>

      <h3 className="panel-subtitle">9. A Note on This Document</h3>
      <p className="small">
        This Terms &amp; Conditions document was drafted to plainly describe how Chilimba
        Circle actually works, in particular that it is record-keeping only and never holds
        or moves real money. It has <strong>not</strong> been reviewed by a lawyer, and
        several things a production terms-of-service document normally needs are
        intentionally left open here rather than guessed at: which country's law governs a
        dispute, an age/capacity-to-contract requirement, a formal limitation-of-liability
        clause, and confirmation of what — if any — financial-services or data-protection
        regulation applies in the places this app is actually used. Please have this
        reviewed by a qualified lawyer before relying on it for real users and real money.
      </p>
    </div>
  );
}
