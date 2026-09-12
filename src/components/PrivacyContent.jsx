import React from "react";
import { TERMS_VERSION } from "./TermsContent.jsx";

// Shares TermsContent's version string rather than tracking its own —
// the two documents were written and reviewed together, so "last
// updated" drifting independently between them would just be confusing,
// not meaningfully more accurate.
export const PRIVACY_VERSION = TERMS_VERSION;

/**
 * The plain-language Privacy Policy — same role as TermsContent.jsx
 * (one shared copy, opened from PrivacyModal.jsx), kept as a separate
 * document rather than folded into the Terms because they answer
 * different questions: Terms is "what are we each agreeing to," this is
 * "what data exists and who can see it." Section 3 of TermsContent.jsx
 * already covers this briefly and links to PRIVACY.md's full technical
 * detail (hashing algorithm, exact fields, retention) — this expands
 * that summary into its own document without duplicating the deep
 * technical detail PRIVACY.md already owns.
 *
 * NOT REVIEWED BY A LAWYER — same flag as TermsContent.jsx; see its doc
 * comment for what that means here.
 */
export default function PrivacyContent() {
  return (
    <div className="terms-content">
      <div className="terms-legal-warning">
        <strong>This is not legal advice.</strong> This policy was written for a small
        community savings tool and has <strong>not been reviewed by a lawyer</strong>. Have it
        reviewed before relying on it for real users and real money — see the note at the end.
      </div>

      <p className="muted tiny">Last updated: {PRIVACY_VERSION}</p>

      <h3 className="panel-subtitle">1. What We Collect</h3>
      <ul className="small">
        <li><strong>Name</strong> — required at sign-up, visible to other members of your own group (the payout schedule is inherently shared).</li>
        <li><strong>Phone number</strong> — required at sign-up. Never shown to other members; used only as an alternate sign-in identifier and for a future PIN-reset option.</li>
        <li><strong>PIN</strong> — never stored or transmitted as entered. Only a one-way PBKDF2-SHA256 hash (100,000 iterations, a unique random value per account) is kept, which can verify a future login but can never be reversed back into your actual PIN, even by us.</li>
        <li><strong>Payment records</strong> — every contribution you log (amount, date, which round it's for) and its confirmation status. This is the core of what OpenBook exists to track.</li>
        <li><strong>Optional profile photo and gender</strong> — a photo you choose to upload (visible to your group, same as your name), and a gender you can optionally give at sign-up used only so the app can address you appropriately in its greeting — nothing else reads or depends on it.</li>
        <li><strong>Mobile money number, if your group uses subscription billing</strong> — the full number is used for that one payment request; only the last 3 digits are kept afterward.</li>
      </ul>

      <h3 className="panel-subtitle">2. Who Can See It</h3>
      <p className="small">
        Your name and photo (if you add one) are visible to other members of your own group —
        the shared payout schedule and roster make that unavoidable. Your individual payment
        history and balance are visible only to you and your group's leaders, never to a
        regular member, and never to anyone in a different group — every group's data is
        kept separate, enforced on our server, not just hidden in the app's interface. Your
        phone number is never shown to any other member, including your group's leaders,
        beyond what's needed for the uses in Section 1.
      </p>

      <h3 className="panel-subtitle">3. We Do Not Hold or Guarantee Funds</h3>
      <p className="small">
        OpenBook records what members report — it never holds, transfers, or has possession
        of any money, and does not guarantee that a reported payment is genuine or that a
        payout will actually arrive. See Section 2 of the Terms &amp; Conditions for the full
        explanation of what that means for disputes and refunds.
      </p>

      <h3 className="panel-subtitle">4. How It's Secured</h3>
      <p className="small">
        PINs are hashed, never stored in plain text (Section 1). Every server request is
        scoped to the signed-in member's own group — one group's data is structurally
        unreachable from another's session, not just hidden by the interface. A profile photo,
        if you add one, lives in a private storage bucket reachable only through a
        group-scoped request, never a public URL. Full technical detail — exact database
        fields, retention, and the security model this summary is based on — is in this
        project's{" "}
        <a
          href="https://github.com/thumelobanda-lab/chilimba-village-tool/blob/main/PRIVACY.md"
          target="_blank"
          rel="noopener noreferrer"
        >
          Privacy &amp; Security documentation
        </a>.
      </p>

      <h3 className="panel-subtitle">5. What We Don't Do</h3>
      <ul className="small">
        <li>We don't sell or share your data with third parties for advertising or any other purpose.</li>
        <li>We don't use your name, phone number, or payment history for anything beyond running the app for your group.</li>
        <li>We don't act as a party to any transaction between members — including a future group noticeboard feature, if built — the same principle as Section 2 of the Terms &amp; Conditions.</li>
      </ul>

      <h3 className="panel-subtitle">6. Your Choices</h3>
      <p className="small">
        A profile photo and gender are both optional and removable — see My Account. Removing
        a member from a group (an admin action) stops their access but keeps their payment
        history intact, the same way an append-only ledger works for everyone; if you want
        your account fully deleted rather than just deactivated, contact us using the details
        in Section 6 of the Terms &amp; Conditions.
      </p>

      <h3 className="panel-subtitle">7. Changes to This Policy</h3>
      <p className="small">
        We may update this policy as the app changes. It's always reachable from My Account,
        the same place as the Terms &amp; Conditions.
      </p>

      <h3 className="panel-subtitle">8. A Note on This Document</h3>
      <p className="small">
        This Privacy Policy was drafted to plainly describe what data OpenBook actually
        collects and how it's handled. It has <strong>not</strong> been reviewed by a lawyer,
        and things a production privacy policy normally needs are intentionally left open
        here rather than guessed at: which data-protection regulation applies in the places
        this app is used (e.g. GDPR, POPIA, or a Zambia-specific framework), a formal data
        retention schedule, and a designated contact for data-protection requests. Please
        have this reviewed by a qualified lawyer before relying on it for real users and real
        money.
      </p>
    </div>
  );
}
