# Provider payment gateways

ProviderBeacon accepts a **customer-approved payment for one calendar month** through PayPal Orders v2 and NOWPayments hosted invoices. The server quotes USD 19 during the existing provider introduction and USD 29 thereafter. A prepaid renewal is priced at the start of the purchased period, so month four costs USD 29 even if purchased during month three. This is not an automatically renewing billing agreement: customers approve every payment. No cards, bank details, wallet keys or PayPal passwords are collected by ProviderBeacon.

`/admin/subscriptions` → **Payment gateways** contains encrypted gateway settings and the payment ledger. The existing `business.manage` permission (owner/administrator), authenticated staff session and canonical Origin are required to modify gateway settings or apply a reviewed payment. The existing `VAULT_MASTER_KEY` encrypts immutable credential versions. Lists, public responses and audit entries never contain the credentials. Old versions remain available for callbacks belonging to old invoices. Keep old merchant apps/credentials operational until their outstanding payments are resolved; revoking keys at the gateway can prevent verification of older payments.

## PayPal setup

1. Use the receiving merchant's PayPal Business account and create a REST application in the [PayPal developer dashboard](https://developer.paypal.com/dashboard/applications/live).
2. Select **Live payments** in ProviderBeacon and enter **Client ID**, **Client Secret**, the receiving account's **Merchant ID**, and **Webhook ID**.
3. Register `https://providerbeacon.com/api/payments/paypal/webhook` for:
   - `CHECKOUT.ORDER.APPROVED`
   - `PAYMENT.CAPTURE.COMPLETED`
   - `PAYMENT.CAPTURE.PENDING`
   - `PAYMENT.CAPTURE.DENIED`
   - `PAYMENT.CAPTURE.REFUNDED`
   - `PAYMENT.CAPTURE.REVERSED`
4. Enable customer payments and save. Enabling authenticates the application and checks that the registered webhook URL and the required approval/completion/refund/reversal event subscriptions match. An all-events webhook is also accepted. A sandbox configuration stays hidden from customer checkout and never grants production access. Changing environment requires entering that environment's credentials.

Orders are created server-side with the exact USD total, UUID invoice reference, intended merchant ID, no shipping and customer confirmation. Creation and capture use deterministic, distinct PayPal request IDs. A lost capture response is recovered by reading the same order. The return URL never proves a payment; the server inspects the order, merchant, invoice, currency, gross amount and completed capture. `CHECKOUT.ORDER.APPROVED` can finish capture if the buyer closes the return page, but only while the order and ownership are still eligible. Webhooks are verified through PayPal's signature-verification API with the stored webhook ID.

## NOWPayments setup

1. Create a merchant account using [NOWPayments](https://nowpayments.io/), configure its receiving wallet/currency, and complete any gateway-required account setup.
2. Copy **API Key** and **IPN Secret** to the NOWPayments form. Do not enter a wallet private key or dashboard password.
3. Enable and save. Enabling makes a read-only authenticated request to the merchant currencies endpoint. Configure supported coins and receiving wallets in NOWPayments. The application includes `https://providerbeacon.com/api/payments/nowpayments/webhook` in each invoice request.

New hosted invoices explicitly request USDT on BNB Smart Chain / BEP20 (`pay_currency: usdtbsc`). The subscription remains priced in USD, and the gateway quotes the amount payable in USDT. The invoice amount, address, network and expiry instructions are authoritative; do not assume that a USD 19 quote always means exactly 19 USDT. Previously created invoices keep their existing settings. Close an old attempt only if no funds have been sent, then create a fresh checkout to use the new default. Gateway fees are borne by the merchant (`is_fee_paid_by_user: false`); the buyer's network fee can still apply. The application requests a fixed-rate invoice. Invoice creation itself does not prove receipt. IPNs require HMAC SHA-512 over recursively sorted JSON. The server then retrieves `/v1/payment/{id}` with the pinned API key and requires the exact local order UUID, invoice ID, USD amount, `finished` status and `actually_paid >= pay_amount`. Waiting, confirmed, exchanging, sending and partially paid states do not grant access. Underpayments or inconsistent identifiers require review.

### Hosted checkout identity

The invoice request sends `ProviderBeacon provider package — one calendar month` as its order description. The merchant/store heading on NOWPayments is controlled by the merchant configuration associated with the API key; the documented invoice API has no per-invoice merchant-name field. Creating another API key under the same merchant does not establish a separate store identity. Inspect the NOWPayments merchant payment/profile settings before changing the name of a shared account. Use a separate merchant configuration for ProviderBeacon if a change would rename checkout for another site. Keep credentials for outstanding invoices valid when replacing the current gateway settings.

## Settlement and recovery

- Verified-email provider ownership is required to create checkout. Suspended plans cannot create new payments. Public methods remain marked unavailable until live configuration is enabled; migration never enables a gateway or activates a provider.
- One open checkout per provider is serialized using the provider row lock. Retries return the same checkout; changing gateways requires closing an unpaid attempt first. A pending review prevents another charge. An uncertain creation response remains an open attempt; close it only if funds have not been sent.
- A local checkout quote lasts three hours. The hosted gateway may impose a shorter payment deadline. Closing or expiring an attempt is not a refund. A later confirmed payment is retained for staff review.
- A transaction locks the member, provider, subscription and payment in the normal order. The first verified settlement applies one month and writes an audit event atomically. Repeated notifications cannot extend the subscription again. The original introductory anchor never resets. Active renewals extend the existing end; otherwise access starts at confirmation.
- Suspension, ownership/domain changes, subscription edits or late payments between checkout and confirmation send funds to review rather than silently overriding staff decisions. Fully verified payments can be applied by an administrator with a reason; this rechecks the gateway, current ownership and suspension and adds one month once. Underpaid/unverified records cannot use that action. After resolving a case with the payer, staff can close its review with a recorded reason. Closing grants no access and makes no refund; it preserves financial references and permits a fresh checkout.
- Signed PayPal refunds/reversals (including partial refunds) and verified crypto refunds mark the payment accordingly. If it previously granted access, the provider package is suspended for staff review, including cases with later renewals. Older completion notifications cannot restore access. Refund execution and any restoration decisions are handled by staff through the merchant account and the existing subscription controls, not by a public endpoint.
- The buyer's return page polls local status and can request verification. NOWPayments payments become independently recheckable after their first valid IPN identifies the payment ID. If no IPN arrives, inspect the invoice in NOWPayments and resend its IPN; an invoice URL is not sufficient proof. Keep gateway notification retry delivery enabled. Do not create a replacement charge to resolve an uncertain capture.
- The ledger retains financial references when an account/provider is deleted, with the deleted association set to null. It stores no raw webhook bodies or payer personal information. Staff can see gateway references and reasons; providers see their own receipts only.

## Validation and deployment

Migration `0029_provider_payments` creates disabled gateway settings, immutable encrypted credentials and payment records. It requires no new Railway environment secret: `VAULT_MASTER_KEY`, `AUTH_PEPPER`, `PUBLIC_APP_URL` and the existing database are used. Merchant credentials are supplied through the protected form, not source control.

Tests cover strict price inputs, month-four prepayment, calendar boundaries, invoice/merchant/currency checks, signature tampering, pending/partial payments, capture-response loss, refund/reversal replay, real MySQL concurrent checkout and settlement, credential redaction/versioning, ownership/session/Origin separation and deterministic receipt pagination. Tests use local gateway responses, never real money. A live merchant checkout and real signed callbacks still require the merchant's own credentials and controlled end-to-end verification before accepting customer funds.

Primary references: [PayPal Orders v2](https://developer.paypal.com/api/orders/v2/orders-create), [PayPal webhook verification](https://developer.paypal.com/api/webhooks/v1/verify-webhook-signature-post), and the [official NOWPayments SDK and API mapping](https://github.com/NowPaymentsIO/nowpayments-sdk-nodejs).
