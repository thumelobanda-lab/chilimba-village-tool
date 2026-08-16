/**
 * SMS sending. Like the mobile money charge in index.js, this is a
 * placeholder — sending real SMS requires a registered account with a
 * gateway that covers Zambia (Africa's Talking is the common choice;
 * Twilio also covers Zambian numbers). Replace the body of sendSms()
 * with a real call once you have an account, and set the API key with:
 *
 *   npx wrangler secret put SMS_API_KEY
 *
 * Never put that key in wrangler.toml [vars] or in source — secrets only.
 */
export async function sendSms(env, phone, text) {
  if (!env.SMS_API_KEY) {
    console.warn("SMS_API_KEY not set — skipping SMS send (placeholder mode).", { phone, text });
    return { ok: false, skipped: true };
  }

  // Example shape for Africa's Talking — adjust to whichever provider you use:
  //
  // const res = await fetch("https://api.africastalking.com/version1/messaging", {
  //   method: "POST",
  //   headers: {
  //     apiKey: env.SMS_API_KEY,
  //     "Content-Type": "application/x-www-form-urlencoded",
  //     Accept: "application/json",
  //   },
  //   body: new URLSearchParams({
  //     username: env.SMS_USERNAME,
  //     to: phone,
  //     message: text,
  //   }),
  // });
  // return { ok: res.ok, status: res.status };

  return { ok: false, skipped: true };
}
