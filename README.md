# 🛍️ ShopFresh - Review Verification Extension

A complete e-commerce review verification system with a browser extension for verifying reviewer identities and product reviews.

**Live Demo:** http://localhost:8000 (after starting the server)

## 🎯 What's Included

### Frontend (Website)
- **index.html** - Home page with product browsing and categories
- **products.html** - Advanced product filtering and search
- **app.js** - Core application logic with Supabase integration
- **style.css** - Complete styling system

### Backend (Supabase)
- **Cloud Database** - Reviews and verification data
- **REST API** - Endpoints for all operations
- **No Code Required** - Ready to use, no backend setup needed

### Browser Extension
- **Extension Files** - Complete extension framework
  - `extension-manifest.json` - Extension configuration
  - `extension-background.js` - Background service worker
  - `extension-content.js` - Content script for badge injection
  - `extension-popup.html` & `extension-popup.js` - Popup UI

### Documentation
- **QUICKSTART.md** - Get started in 5 minutes
- **INTEGRATION_GUIDE.md** - Full integration details
- **REVIEW_VERIFICATION_SETUP.md** - Detailed setup instructions

## ✨ Features

### User Features
- 🔐 Account creation and sign-in
- ✓ Identity verification (Passport, National ID, Driver's License, Email)
- 📝 Submit product reviews with ratings
- 🎖️ Verified purchase badges
- 👤 User profile and verification status

### Review System
- ⭐ 1-5 star ratings
- 💬 Written reviews
- 🔍 Search and filter reviews
- ✓ Verification score display (0-100%)
- 🏷️ Verified purchase badges

### Extension Features
- 🎖️ Verification badges on reviews
- 📊 Credibility scoring
- 🎨 Review highlighting
- 📈 Review analytics
- 🔐 Secure verification status

## 🚀 Getting Started

### 1. Start the Website
```bash
cd /vercel/share/v0-project
python3 -m http.server 8000
```
Visit: http://localhost:8000

### 2. Test the Flow
1. Sign up with any email/password
2. Verify your identity (select ID type, enter number)
3. Go to a product and leave a review
4. See your review appear with verification badge

### 3. Load the Extension (Chrome)
1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension-*.js` files folder
5. Reload the website to see badges

## 📊 Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Browser (Client)                        │
│  ┌──────────────────────────────────────────────────┐   │
│  │ ShopFresh Website (HTML/CSS/JS)                  │   │
│  │ • User authentication                            │   │
│  │ • Product browsing                               │   │
│  │ • Review submission                              │   │
│  │ • ID verification                                │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Browser Extension                                │   │
│  │ • Injects verification badges                    │   │
│  │ • Calculates credibility scores                  │   │
│  │ • Highlights verified reviews                    │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────┬───────────────────────────────────────┘
                   │ REST API Calls
┌──────────────────┴───────────────────────────────────────┐
│            Supabase Cloud Database                       │
│ ┌──────────────────────────────────────────────────┐    │
│ │ reviews table                                    │    │
│ │ • product_id, user_id, rating, text             │    │
│ │ • verified_purchase, verified_id, score         │    │
│ └──────────────────────────────────────────────────┘    │
│ ┌──────────────────────────────────────────────────┐    │
│ │ user_verifications table                         │    │
│ │ • user_id, id_type, id_number, score            │    │
│ │ • verification_status, created_at                │    │
│ └──────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## 🔧 Key Technologies

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Supabase (PostgreSQL + REST API)
- **Extension**: Chrome Manifest V3
- **Authentication**: Client-side (demo mode) / Can use Supabase Auth for production
- **Storage**: Cloud database (Supabase)

## 📝 Supabase Integration

### API Endpoint
```
https://szevkqlykoqtudnulits.supabase.co/rest/v1/
```

### Tables
- **reviews** - Product reviews with verification data
- **user_verifications** - User identity verification records

### Key Functions in app.js
```javascript
// Submit a review
submitReview(productId, rating, text, verifiedPurchase)

// Verify user identity
verifyUserIdentity(verificationData)

// Load reviews for a product
loadProductReviews(productId)

// Query Supabase
supabaseRequest(endpoint, method, body)
```

## 🎯 Verification Score System

**Score Calculation (0-100%):**
- ID Type Provided: +30%
- Valid ID Number: +40%
- Date Verified: +30%

**Score Interpretation:**
- **70-100%**: ✅ Verified (Green badge)
- **40-69%**: ⚠️ Partially Verified (Yellow badge)
- **0-39%**: ❌ Unverified (Red badge)

## 📂 File Structure

```
/vercel/share/v0-project/
├── index.html                          # Home page
├── products.html                       # Products page
├── app.js                              # Core app logic (1200+ lines)
├── style.css                           # Styling (800+ lines)
├── extension-manifest.json             # Chrome extension config
├── extension-background.js             # Background service worker
├── extension-content.js                # Content script
├── extension-popup.html                # Popup UI
├── extension-popup.js                  # Popup logic
├── extension-config.json               # Extension configuration
├── QUICKSTART.md                       # Quick start guide
├── INTEGRATION_GUIDE.md                # Full integration details
├── REVIEW_VERIFICATION_SETUP.md        # Setup instructions
└── README.md                           # This file
```

## 🔐 Security Considerations

### Current Implementation (Demo)
- ✓ Client-side authentication
- ✓ Public API access (for demo)
- ✓ No sensitive data encryption

### Production Recommendations
- [ ] Implement Supabase Auth
- [ ] Add Row Level Security (RLS) policies
- [ ] Encrypt ID numbers before storage
- [ ] Use server-side verification score calculation
- [ ] Implement email verification
- [ ] Add rate limiting
- [ ] Set up audit logging
- [ ] Use HTTPS for all requests

## 🧪 Testing Scenarios

### Verified User Review
```
1. Email: alice@example.com / Password: test123
2. ID: Passport / Number: 12345678
3. Score: 100%
4. Review shows ✅ Verified badge
```

### Partially Verified User
```
1. Email: bob@example.com / Password: test123
2. ID: Email / Number: bob@test.com
3. Score: 60%
4. Review shows ⚠️ Partial badge
```

### Unverified User
```
1. Email: charlie@example.com / Password: test123
2. Skip verification
3. Score: 0%
4. Review shows ❌ Unverified badge
```

## 🛠️ Development

### Add a New Product
Edit `app.js` and add to `PRODUCTS` array:
```javascript
{ id: 21, name: 'Your Product', cat: 'Category', price: 999, rating: 4.5, reviews: 50, emoji: '🎯', desc: 'Description' }
```

### Customize Verification Types
Edit `products.html` → `verif-id-type` select element

### Modify Verification Logic
Edit `calculateVerificationScore()` function in `app.js`

### Change Colors/Styling
Edit CSS variables in `style.css`:
```css
:root {
  --green: #1D9E75;
  --green-dark: #0F6E56;
  --green-light: #E1F5EE;
  /* ... */
}
```

## 📊 API Examples

### Get Reviews for Product
```bash
curl "https://szevkqlykoqtudnulits.supabase.co/rest/v1/reviews?product_id=eq.1" \
  -H "apikey: YOUR_KEY"
```

### Submit a Review
```bash
curl -X POST "https://szevkqlykoqtudnulits.supabase.co/rest/v1/reviews" \
  -H "apikey: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": 1,
    "user_id": "user@example.com",
    "user_name": "John",
    "rating": 5,
    "text": "Great product!",
    "verified_purchase": true,
    "verified_id": true,
    "id_verification_score": 100
  }'
```

### Get User Verification
```bash
curl "https://szevkqlykoqtudnulits.supabase.co/rest/v1/user_verifications?user_id=eq.user@example.com" \
  -H "apikey: YOUR_KEY"
```

## 🚢 Deployment

### Deploy Website to Vercel
```bash
vercel
```

### Deploy Extension
1. Build final extension package
2. Submit to Chrome Web Store
3. Configure manifest for production URLs

### Production Checklist
- [ ] Set up Supabase RLS policies
- [ ] Enable HTTPS everywhere
- [ ] Implement email verification
- [ ] Add admin dashboard
- [ ] Set up error logging (Sentry)
- [ ] Configure CORS properly
- [ ] Implement rate limiting
- [ ] Add privacy policy
- [ ] Set up analytics

## 📚 Documentation

- **QUICKSTART.md** - 5-minute quick start
- **INTEGRATION_GUIDE.md** - Complete integration guide (1000+ lines)
- **REVIEW_VERIFICATION_SETUP.md** - Detailed setup guide

## 🐛 Troubleshooting

### Reviews Not Showing
```javascript
// Check console for errors
console.log("[v0] API response:", response);

// Verify Supabase connection
supabaseRequest('/reviews').then(console.log);
```

### Verification Not Working
1. Check all form fields are filled
2. Verify consent checkbox is checked
3. Look at Network tab for API errors
4. Check Supabase API key

### Extension Not Loading
1. Verify manifest.json syntax
2. Check all file paths are correct
3. Enable Developer Mode in Chrome
4. Check Extension error log

## 💡 Pro Tips

1. **Use the browser DevTools** - Press F12 to debug
2. **Check Supabase dashboard** - View data in real-time
3. **Monitor Network tab** - See all API calls
4. **Use console.log** - Search for `[v0]` messages
5. **Test in Incognito** - Fresh session without cache

## 🤝 Contributing

To extend this project:
1. Add new verification methods
2. Implement review moderation
3. Create admin dashboard
4. Add analytics features
5. Enhance extension UI

## 📄 License

This project is provided as-is for testing and educational purposes.

## 🎓 Learning Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Chrome Extension Guide](https://developer.chrome.com/docs/extensions/)
- [REST API Basics](https://restfulapi.net/)
- [JavaScript Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)

## 📞 Support

For detailed information, see:
- QUICKSTART.md - Quick reference
- INTEGRATION_GUIDE.md - Full details
- REVIEW_VERIFICATION_SETUP.md - Setup help

---

**Version:** 1.0.0  
**Created:** June 23, 2026  
**Status:** Ready for testing & customization

🚀 **Ready to get started?** Check out QUICKSTART.md!
