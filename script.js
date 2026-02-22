let templates = [];
const DEFAULT_TEMPLATES = [
    {
        id: "default_1",
        name: 'Good Morning Sun',
        category: 'Good Morning',
        type: 'image',
        src: 'assets/good_morning.png',
        premium: false,
        frame: { x: 0.5, y: 0.42, r: 0.25, type: 'circle' }
    },
    {
        id: "default_2",
        name: 'Neon Motivation',
        category: 'Motivation',
        type: 'image',
        src: 'assets/motivation.png',
        premium: true,
        frame: { x: 0.5, y: 0.5, w: 0.35, h: 0.35, type: 'square' }
    },
    {
        id: "default_v1",
        name: 'Ocean Calm',
        category: 'Video',
        type: 'video',
        src: 'https://vjs.zencdn.net/v/oceans.mp4',
        premium: false,
        frame: { x: 0.5, y: 0.5, r: 0.2, type: 'circle' }
    },
    {
        id: "default_v2",
        name: 'Flower Bloom',
        category: 'Video',
        type: 'video',
        src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
        premium: false,
        frame: { x: 0.5, y: 0.5, r: 0.25, type: 'circle' }
    }
];

let selectedTemplate = null;
let userPhoto = null;
let canvas, ctx, photoUpload;
let videoEl = null;
let isRendering = false;

// Enhanced Editor State
let editorText = "Write your name here";
let editorFont = "Outfit";
let editorColor = "#ffffff";
let editorSize = 50;
let textX = 540; // Default center
let textY = 930; // Default bottom area
let watermark = "Crafto Status Maker";

// Profile Pic State
let userProfilePic = null;
let profileX = 200;
let profileY = 200;
let profileSize = 150;
let isProfileVisible = true;

// Template Photo State
let photoX = 0;
let photoY = 0;
let photoSize = 0;
let isDraggingPhoto = false;

// Interaction State
let activeTarget = null; // 'profile' or 'photo'
let isDragging = false;
let dragStartX, dragStartY;
let initialX, initialY, initialSize;
let initialPinchDist = 0;

// Tap Tracking
let lastTapTime = 0;
let lastTapX = 0;
let lastTapY = 0;

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyDqfN_aN5xA7b1HDNIIbRLIXhFmO2M7Qmk",
    authDomain: "whatsapp-status-8eddd.firebaseapp.com",
    projectId: "whatsapp-status-8eddd",
    storageBucket: "whatsapp-status-8eddd.firebasestorage.app",
    messagingSenderId: "903368195803",
    appId: "1:903368195803:web:1e03652603ec6905bc56fe",
    measurementId: "G-LZ9503W5S1"
};

// Initialize Firebase SDKs (using compat for existing logic)
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

let verificationId = null;
let isLogged = false;
let isSubscribed = false; // Real-time subscription status
let subConfig = { price: 0, upiId: '', planName: 'Crafto Pro' }; // Loaded from admin config

const greetings = [
    "Namaste! 🙏",
    "Suprabhat! ☀️",
    "Shubh Ratri! 🌙",
    "नमस्ते! 🙏",
    "शुभ प्रभात! ☀️"
];

// Initialize UI
window.onload = () => {
    // 1. Always ensure splash screen disappears
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => {
                splash.style.display = 'none';
            }, 800);
        }
    }, 2000);

    // 2. Register Service Worker for PWA/APK
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(() => console.log("Service Worker Registered"))
            .catch(err => console.log("Service Worker Failed", err));
    }

    // 3. Initialize UI Components
    try {
        canvas = document.getElementById('main-canvas');
        if (canvas) ctx = canvas.getContext('2d');

        photoUpload = document.getElementById('photo-upload');
        if (photoUpload) photoUpload.onchange = handlePhotoUpload;

        if (typeof lucide !== 'undefined') lucide.createIcons();

        // Load Templates from Firestore
        loadCloudTemplates();

        // Subscription System Init
        loadSubscriptionConfig();
        checkSubscriptionStatus();

        // Set random greeting
        const greetingText = greetings[Math.floor(Math.random() * greetings.length)];
        const greetingEl = document.getElementById('greeting');
        if (greetingEl) greetingEl.innerText = greetingText;

        initCanvasInteractions();

        // Safe Firebase Setup
        if (typeof firebase !== 'undefined' && firebaseConfig.apiKey !== "YOUR_API_KEY") {
            try {
                window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
                    'size': 'invisible'
                });
            } catch (fbErr) {
                console.error("Firebase Recaptcha Init Error:", fbErr);
            }
        }

        // setupAutoTab('.otp-input'); // No longer needed
        // setupAutoTab('.pin-input'); // No longer needed

        // Auth State Listener for Google Auth
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                console.log("Persistent user found:", user.email);
                loginSuccess(user);
            } else {
                console.log("No user logged in, showing auth overlay");
                document.getElementById('auth-overlay').style.display = 'flex';
                document.getElementById('auth-overlay').style.opacity = '1';
            }
        });

    } catch (e) {
        console.error("Initialization Error:", e);
    }
};

async function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        const result = await firebase.auth().signInWithPopup(provider);
        console.log("Login successful:", result.user.displayName);
        // State change listener will handle the UI update
    } catch (error) {
        console.error("Google Login Error:", error);
        if (error.code === 'auth/popup-closed-by-user') return;
        alert("Login failed: " + error.message);
    }
}

function loginSuccess(user) {
    isLogged = true;
    const name = user.displayName || "User";
    const email = user.email || "";
    const photoUrl = user.photoURL || "";

    // Store for legacy logic if needed
    localStorage.setItem('user_logged', 'true');
    localStorage.setItem('user_email', email);
    localStorage.setItem('user_phone', email); // Hack to keep subscription logic working which uses 'user_phone'

    // Update Profile UI
    const profilePhone = document.getElementById('profile-phone-display');
    if (profilePhone) profilePhone.innerText = name;

    const profileSubtitle = document.querySelector('.profile-subtitle');
    if (profileSubtitle) profileSubtitle.innerText = email;

    // Load and Sync Profile Picture
    if (photoUrl) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = photoUrl;
        img.onload = () => {
            userProfilePic = img;
            const preview = document.getElementById('profile-img-preview');
            const placeholder = document.getElementById('profile-icon-placeholder');
            if (preview) { preview.src = photoUrl; preview.style.display = 'block'; }
            if (placeholder) placeholder.style.display = 'none';

            const headerImg = document.getElementById('header-profile-img');
            const headerIcon = document.getElementById('header-profile-icon');
            if (headerImg) { headerImg.src = photoUrl; headerImg.style.display = 'block'; }
            if (headerIcon) headerIcon.style.display = 'none';

            drawCanvas(); // Update canvas if open
        };
    }

    // Hide Auth Overlay
    const authOverlay = document.getElementById('auth-overlay');
    if (authOverlay) {
        authOverlay.style.opacity = '0';
        setTimeout(() => {
            authOverlay.style.display = 'none';
            renderTemplates();
            checkSubscriptionStatus();
        }, 500);
    }
}

function handleLogout() {
    if (confirm("Are you sure you want to logout?")) {
        firebase.auth().signOut().then(() => {
            localStorage.clear();
            location.reload();
        });
    }
}

function switchView(viewId, el) {
    const views = ['home-view', 'explore-view', 'alerts-view', 'profile-view', 'gallery-view'];
    views.forEach(id => {
        const view = document.getElementById(id);
        if (view) view.style.display = 'none';
    });

    const target = document.getElementById(viewId);
    if (target) {
        target.style.display = (viewId === 'home-view' || viewId === 'editor-view') ? 'block' : 'flex';
    }

    // Sync bottom nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        const span = item.querySelector('span');
        if (span) {
            const text = span.innerText.toLowerCase();
            if (viewId.includes(text)) item.classList.add('active');
            // Special case for Home
            if (viewId === 'home-view' && text === 'home') item.classList.add('active');
        }
    });

    if (el) {
        el.classList.add('active');
    }
}

function showProfile() { switchView('profile-view'); }
function showHome() { switchView('home-view'); }

function searchTemplates(query) {
    const q = query.toLowerCase().trim();
    const defaultContent = document.getElementById('explore-default-content');
    const resultsContainer = document.getElementById('explore-results');

    if (!q) {
        if (defaultContent) defaultContent.style.display = 'block';
        if (resultsContainer) resultsContainer.style.display = 'none';
        return;
    }

    if (defaultContent) defaultContent.style.display = 'none';
    if (resultsContainer) resultsContainer.style.display = 'block';

    const filtered = templates.filter(t =>
        (t.name && t.name.toLowerCase().includes(q)) ||
        (t.category && t.category.toLowerCase().includes(q))
    );

    renderFilteredTemplates(filtered);
}

function renderFilteredTemplates(filtered) {
    const grid = document.getElementById('explore-results-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (filtered.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">No matching templates found</div>`;
        return;
    }

    filtered.forEach(t => {
        const div = document.createElement('div');
        div.className = 'template-card';
        div.style.backgroundColor = '#0a0a0a';
        let mediaHtml = (t.type === 'video')
            ? `<video src="${t.src}" muted loop playsinline autoplay style="width:100%; height:100%; object-fit:cover;"></video>`
            : `<img src="${t.src}" alt="${t.name}">`;

        div.innerHTML = `
            ${mediaHtml}
            ${t.premium ? '<div class="premium-tag">PREMIUM</div>' : ''}
            <div class="template-info">${t.name}</div>
        `;
        div.onclick = () => openEditor(t);
        grid.appendChild(div);
    });
}

function handleLogout() {
    if (confirm("Logout? (Your PIN will be saved on this device)")) {
        localStorage.removeItem('user_logged');
        location.reload();
    }
}

function resendOTP() {
    alert("OTP Resent!");
    startTimer();
}

function startTimer() {
    let timeLeft = 30;
    const timerElement = document.getElementById('timer');
    const timer = setInterval(() => {
        timeLeft--;
        if (timerElement) timerElement.innerText = ` (in ${timeLeft}s)`;
        if (timeLeft <= 0) {
            clearInterval(timer);
            if (timerElement) timerElement.innerText = "";
        }
    }, 1000);
}

function filterTemplates(category, el) {
    // Update active UI state
    const items = document.querySelectorAll('.category-item');
    items.forEach(p => p.classList.remove('active'));
    el.classList.add('active');

    renderTemplates(category);
}

function renderTemplates(filter = 'All') {
    let storedTemplates = [];
    try {
        const stored = localStorage.getItem('crafto_templates');
        storedTemplates = stored ? JSON.parse(stored) : DEFAULT_TEMPLATES;
        if (!Array.isArray(storedTemplates)) storedTemplates = DEFAULT_TEMPLATES;

        // SMART MIGRATION: Only add defaults if that specific image path is missing
        let modified = false;
        DEFAULT_TEMPLATES.forEach(dt => {
            const pathExists = storedTemplates.some(t => t.src === dt.src);
            if (!pathExists) {
                storedTemplates.push(dt);
                modified = true;
            }
        });
        if (modified) {
            localStorage.setItem('crafto_templates', JSON.stringify(storedTemplates));
        }
    } catch (parseErr) {
        console.error("Error parsing templates from storage:", parseErr);
        storedTemplates = DEFAULT_TEMPLATES;
    }
    templates = storedTemplates;

    const grid = document.getElementById('template-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const filtered = filter === 'All'
        ? templates
        : templates.filter(t => t.category.toLowerCase() === filter.toLowerCase());

    if (filtered.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">No templates found in ${filter}</div>`;
        return;
    }

    filtered.forEach(t => {
        const div = document.createElement('div');
        div.className = 'template-card';
        // Base background to avoid white flash
        div.style.backgroundColor = '#0a0a0a';

        let mediaHtml = '';
        if (t.type === 'video') {
            // Simplified video tag for broader compatibility
            mediaHtml = `<video src="${t.src}" muted loop playsinline autoplay preload="metadata" style="width:100%; height:100%; object-fit:cover; pointer-events:none; display: block;"></video>`;
        } else {
            mediaHtml = `<img src="${t.src}" alt="${t.name}" onerror="this.src='https://via.placeholder.com/300?text=Asset+Not+Found'">`;
        }

        div.innerHTML = `
            ${mediaHtml}
            ${t.premium ? '<div class="premium-tag" style="position:absolute; top:8px; right:8px; background:var(--secondary); color:#000; padding:2px 8px; border-radius:4px; font-size:0.65rem; font-weight:800;">PREMIUM</div>' : ''}
            <div class="template-info" style="position:absolute; bottom:0; padding:10px; background:linear-gradient(transparent, rgba(0,0,0,0.8)); width:100%; font-size:0.8rem;">
                ${t.name}
            </div>
        `;
        div.onclick = () => openEditor(t);
        grid.appendChild(div);
    });
}

const BLANK_GRADIENTS = [
    ['#667eea', '#764ba2'],
    ['#f093fb', '#f5576c'],
    ['#4facfe', '#00f2fe'],
    ['#43e97b', '#38f9d7'],
    ['#fa709a', '#fee140'],
    ['#a18cd1', '#fbc2eb'],
    ['#ffecd2', '#fcb69f'],
    ['#0c3483', '#a2b6df'],
    ['#1e3c72', '#2a5298'],
    ['#ff9a9e', '#fecfef'],
];

function createBlankStatus() {
    const gradient = BLANK_GRADIENTS[Math.floor(Math.random() * BLANK_GRADIENTS.length)];

    const blankTemplate = {
        id: 'blank_' + Date.now(),
        name: 'Blank Canvas',
        category: 'Custom',
        type: 'blank',
        gradient: gradient,
        src: '',
        premium: false,
        frame: { x: 0.5, y: 0.5, r: 0.2, type: 'circle' }
    };

    openEditor(blankTemplate);
}

function openEditor(template) {
    selectedTemplate = template;
    resetPhotoPosition();

    if (!canvas) canvas = document.getElementById('main-canvas');
    if (canvas) {
        // Lock 1080x1080 immediately
        canvas.width = 1080;
        canvas.height = 1080;
        ctx = canvas.getContext('2d', { alpha: false });

        // Initial solid black to prevent flickering from previous session
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, 1080, 1080);
    }

    document.getElementById('editor-view').style.display = 'flex';

    if (template.type === 'video') {
        if (!videoEl) {
            videoEl = document.createElement('video');
            videoEl.loop = true;
            videoEl.muted = true;
            videoEl.playsInline = true;
            videoEl.autoplay = true;
        }

        // Only set crossOrigin for external URLs to avoid local load failures
        if (template.src.startsWith('http')) {
            videoEl.crossOrigin = "anonymous";
        } else {
            videoEl.removeAttribute('crossOrigin');
        }

        videoEl.src = template.src;
        videoEl.load();

        const startRender = () => {
            isRendering = true;
            if (activeRequestId) cancelAnimationFrame(activeRequestId);
            renderLoop();
        };

        videoEl.play().then(startRender).catch(err => {
            console.warn("Autoplay blocked or load error, forcing render anyway");
            startRender();
        });
    } else {
        isRendering = false; // Stop any active video loops
        drawCanvas();
    }
}

function closeEditor() {
    isRendering = false;
    if (activeRequestId) cancelAnimationFrame(activeRequestId);
    activeRequestId = null;

    if (videoEl) {
        videoEl.pause();
        videoEl.src = "";
    }
    document.getElementById('editor-view').style.display = 'none';
    selectedTemplate = null;
    userPhoto = null;
}

// Image Cache to prevent flickering and ensure immediate drawing
const imgCache = {};

function drawCanvas() {
    if (!selectedTemplate) return;

    if (!canvas) canvas = document.getElementById('main-canvas');
    if (canvas && !ctx) ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (selectedTemplate.type === 'video') return; // Handled by renderLoop

    // Handle blank canvas with gradient
    if (selectedTemplate.type === 'blank' && selectedTemplate.gradient) {
        const grad = ctx.createLinearGradient(0, 0, 1080, 1080);
        grad.addColorStop(0, selectedTemplate.gradient[0]);
        grad.addColorStop(1, selectedTemplate.gradient[1]);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1080, 1080);
        drawOverlays();
        return;
    }

    const render = (bImg) => {
        // No clearRect needed when drawing full-screen background
        ctx.drawImage(bImg, 0, 0, 1080, 1080);
        drawOverlays();
    };

    if (imgCache[selectedTemplate.src]) {
        render(imgCache[selectedTemplate.src]);
    } else {
        const img = new Image();
        img.crossOrigin = "anonymous";
        // Add cache-buster for external URLs to fix CORS issues in some browsers
        const src = selectedTemplate.src.startsWith('http')
            ? selectedTemplate.src + (selectedTemplate.src.includes('?') ? '&' : '?') + 't=' + Date.now()
            : selectedTemplate.src;
        img.src = src;
        img.onload = () => {
            imgCache[selectedTemplate.src] = img;
            render(img);
        };
        img.onerror = () => {
            console.error("Failed to load template image:", selectedTemplate.src);
            // Fallback for local assets if cache-buster fails
            if (src !== selectedTemplate.src) {
                img.src = selectedTemplate.src;
            }
        };
    }
}

let activeRequestId = null;
function renderLoop() {
    if (!isRendering || !selectedTemplate || selectedTemplate.type !== 'video') return;

    // Only render if video is actually playing and has a frame
    if (videoEl && videoEl.readyState >= 2) {
        // No clearRect needed for full-frame video backgrounds
        ctx.drawImage(videoEl, 0, 0, 1080, 1080);
        drawOverlays();
    }

    activeRequestId = requestAnimationFrame(renderLoop);
}

function drawOverlays() {
    // 1. Draw Template Frame Photo
    if (userPhoto) {
        const f = selectedTemplate.frame;
        // Use interactive state instead of fixed frame values
        const px = photoX;
        const py = photoY;

        ctx.save();
        if (f.type === 'circle') {
            const pr = photoSize / 2;
            ctx.beginPath();
            ctx.arc(px, py, pr, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(userPhoto, px - pr, py - pr, pr * 2, pr * 2);
        } else {
            const pw = photoSize;
            const ph = photoSize; // Defaulting to square aspect
            ctx.drawImage(userPhoto, px - pw / 2, py - ph / 2, pw, ph);
        }
        ctx.restore();
    }

    // 2. Draw User Profile Picture (Global Overlay)
    if (userProfilePic && isProfileVisible) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(profileX, profileY, profileSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(userProfilePic, profileX - profileSize / 2, profileY - profileSize / 2, profileSize, profileSize);
        ctx.restore();
    }

    // 3. Draw Text
    ctx.save();
    ctx.font = `bold ${editorSize * 1.5}px ${editorFont}`;
    ctx.fillStyle = editorColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 10;

    if (editorText) {
        wrapText(ctx, editorText, textX, textY, 900, editorSize * 1.8);
    }
    ctx.restore();

    // 3. Watermark
    ctx.save();
    ctx.font = "300 24px Outfit";
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.textAlign = "right";
    ctx.fillText(watermark, 1040, 1040);
    ctx.restore();
}

function togglePanel(id) {
    const panels = document.querySelectorAll('.editor-panel');
    const target = document.getElementById(id);
    const isVisible = target.style.display === 'flex';

    panels.forEach(p => p.style.display = 'none');

    if (!isVisible) {
        target.style.display = 'flex';
        // Auto-focus if it's the text panel
        if (id === 'text-panel') {
            const field = document.getElementById('text-input-field');
            if (field) {
                setTimeout(() => field.focus(), 50);
            }
        }
    } else {
        target.style.display = 'none';
        document.activeElement.blur();
    }
}

function wrapText(context, text, x, y, maxWidth, lineHeight) {
    const lines = text.split('\n');
    let currentY = y - ((lines.length - 1) * lineHeight) / 2;

    for (let i = 0; i < lines.length; i++) {
        const words = lines[i].split(' ');
        let line = '';
        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = context.measureText(testLine);
            if (metrics.width > maxWidth && n > 0) {
                context.fillText(line, x, currentY);
                line = words[n] + ' ';
                currentY += lineHeight;
            } else {
                line = testLine;
            }
        }
        context.fillText(line.trim(), x, currentY);
        currentY += lineHeight;
    }
}

function showTextEditor() {
    const field = document.getElementById('text-input-field');
    if (field) {
        field.value = editorText;
        field.focus();
        // Optional: Scroll to it if needed
        field.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
}

function updateTextFromInput(val) {
    editorText = val;
    drawCanvas();
}

function applyPreset(text) {
    const field = document.getElementById('text-input-field');
    if (field) {
        field.value = text;
        editorText = text;
        drawCanvas();
    }
}

function closeTextEditor() {
    // In inline mode, we don't necessarily "close" it, but we can clear focus
    document.activeElement.blur();
}

function saveText() {
    drawCanvas();
}

function setPresetText(text) {
    document.getElementById('text-input-field').value = text;
}

function setFont(f) {
    editorFont = f;
    drawCanvas();
}

function setColor(c) {
    editorColor = c;
    drawCanvas();
}

function setSize(s) {
    editorSize = s;
    drawCanvas();
}

function setPositionX(x) {
    textX = parseInt(x);
    drawCanvas();
}

function setPositionY(y) {
    textY = parseInt(y);
    drawCanvas();
}

// Global Profile Picture Handlers
function triggerProfileUpload() {
    document.getElementById('profile-pic-upload').click();
}

function handleProfilePicture(input) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            localStorage.setItem('user_profile_pic', dataUrl);
            const img = new Image();
            img.src = dataUrl;
            img.onload = () => {
                userProfilePic = img;
                document.getElementById('profile-img-preview').src = dataUrl;
                document.getElementById('profile-img-preview').style.display = 'block';
                document.getElementById('profile-icon-placeholder').style.display = 'none';
                // Sync to header avatar
                const headerImg = document.getElementById('header-profile-img');
                const headerIcon = document.getElementById('header-profile-icon');
                if (headerImg) { headerImg.src = dataUrl; headerImg.style.display = 'block'; }
                if (headerIcon) headerIcon.style.display = 'none';
            };
        };
        reader.readAsDataURL(file);
    }
}

function setProfileX(x) {
    profileX = parseInt(x);
    drawCanvas();
}

function setProfileY(y) {
    profileY = parseInt(y);
    drawCanvas();
}

function setProfileSize(s) {
    profileSize = parseInt(s);
    drawCanvas();
}

function toggleProfileVisibility() {
    isProfileVisible = !isProfileVisible;
    drawCanvas();
}

function triggerPhotoUpload() {
    photoUpload.click();
}

function handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                userPhoto = img;
                drawCanvas();
            };
        };
        reader.readAsDataURL(file);
    }
}

// This block was added based on the instruction, assuming it's part of an initialization function
// Video Interaction Logic
const activePointers = new Map();

function initCanvasInteractions() {
    if (!canvas) canvas = document.getElementById('main-canvas');
    if (!canvas) return;

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointercancel', handlePointerUp);
}

function handlePointerDown(e) {
    activePointers.set(e.pointerId, e);

    const rect = canvas.getBoundingClientRect();
    const touchX = ((e.clientX - rect.left) / rect.width) * 1080;
    const touchY = ((e.clientY - rect.top) / rect.height) * 1080;

    // Check hit for Profile Image
    if (userProfilePic && isProfileVisible) {
        const dist = Math.sqrt((touchX - profileX) ** 2 + (touchY - profileY) ** 2);
        if (dist < profileSize / 2) {
            startDragging(e, touchX, touchY, 'profile', profileX, profileY, profileSize);
            return;
        }
    }

    // Check hit for Template Photo
    if (userPhoto) {
        const dist = Math.sqrt((touchX - photoX) ** 2 + (touchY - photoY) ** 2);
        if (dist < photoSize / 2) {
            startDragging(e, touchX, touchY, 'photo', photoX, photoY, photoSize);
            return;
        }
    }
}

function startDragging(e, tx, ty, target, x, y, size) {
    // Double tap detection for hiding (Hiding)
    const now = Date.now();
    const distToLastTap = Math.sqrt((tx - lastTapX) ** 2 + (ty - lastTapY) ** 2);

    if (now - lastTapTime < 300 && distToLastTap < 40) {
        if (target === 'profile') isProfileVisible = false;
        if (target === 'photo') userPhoto = null; // Remove template photo
        drawCanvas();
        lastTapTime = 0;
        return;
    }

    lastTapTime = now;
    lastTapX = tx;
    lastTapY = ty;

    isDragging = true;
    activeTarget = target;
    dragStartX = tx;
    dragStartY = ty;
    initialX = x;
    initialY = y;
    initialSize = size;
    canvas.setPointerCapture(e.pointerId);
}

function handlePointerMove(e) {
    if (!isDragging) return;

    activePointers.set(e.pointerId, e);
    const rect = canvas.getBoundingClientRect();

    if (activePointers.size === 1) {
        const currentX = ((e.clientX - rect.left) / rect.width) * 1080;
        const currentY = ((e.clientY - rect.top) / rect.height) * 1080;

        const dx = currentX - dragStartX;
        const dy = currentY - dragStartY;

        if (activeTarget === 'profile') {
            profileX = initialX + dx;
            profileY = initialY + dy;
        } else if (activeTarget === 'photo') {
            photoX = initialX + dx;
            photoY = initialY + dy;
        }

        drawCanvas();
    } else if (activePointers.size === 2) {
        const pointers = Array.from(activePointers.values());
        const p1 = pointers[0];
        const p2 = pointers[1];
        const currentDist = Math.sqrt((p1.clientX - p2.clientX) ** 2 + (p1.clientY - p2.clientY) ** 2);

        if (initialPinchDist === 0) {
            initialPinchDist = currentDist;
        } else {
            const scale = currentDist / initialPinchDist;
            const newSize = Math.max(50, Math.min(1080, initialSize * scale));

            if (activeTarget === 'profile') profileSize = newSize;
            else if (activeTarget === 'photo') photoSize = newSize;

            drawCanvas();
        }
    }
}

function handlePointerUp(e) {
    activePointers.delete(e.pointerId);
    if (activePointers.size < 2) initialPinchDist = 0;
    if (activePointers.size === 0) {
        isDragging = false;
        activeTarget = null;
    }
}

function resetPhotoPosition() {
    if (!selectedTemplate) return;
    const f = selectedTemplate.frame;
    photoX = f.x * 1080;
    photoY = f.y * 1080;

    // Support both 'r' (radius) and 'w' (width) for all types to avoid NaN errors
    if (f.r) {
        photoSize = f.r * 2 * 1080;
    } else if (f.w) {
        photoSize = f.w * 1080;
    } else {
        photoSize = 300; // Safe default
    }
}

// Placeholder for openEditor function where resetPhotoPosition should be called
// function openEditor() {
//     // ... existing openEditor logic ...
//     resetPhotoPosition(); // Call this when a new template is selected or editor is opened
//     // ...
// }

// Placeholder for drawOverlays function to use photoX, photoY, photoSize
// function drawOverlays() {
//     // ... existing drawOverlays logic ...
//     if (userPhoto) {
//         // Draw userPhoto using photoX, photoY, photoSize
//     }
//     // ...
// }

function downloadImage() {
    if (subConfig.price > 0 && !isSubscribed) {
        togglePaymentModal(true);
        return;
    }

    // Safety check: Only trigger video recording if template is explicitly 'video' 
    // AND has a valid video source extension.
    const isVideo = selectedTemplate &&
        selectedTemplate.type === 'video' &&
        (selectedTemplate.src.toLowerCase().endsWith('.mp4') ||
            selectedTemplate.src.toLowerCase().endsWith('.webm'));

    if (isVideo) {
        recordVideo('download').catch(err => {
            console.error("Video recording failed, falling back to image:", err);
            saveCanvasAsImage();
        });
    } else {
        saveCanvasAsImage();
    }
}

function saveCanvasAsImage() {
    try {
        // Use a slightly lower quality if 1.0 fails or produces giant files
        const dataUrl = canvas.toDataURL('image/png');
        saveToGallery(dataUrl);

        const link = document.createElement('a');
        link.download = `crafto-status-${Date.now()}.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (e) {
        console.error("Image download failed:", e);
        if (e.name === 'SecurityError') {
            alert("🔒 Security Error: This template uses an image from a different website that blocks downloads. \n\nTry:\n1. Use a different template\n2. Log in again\n3. Take a screenshot");
        } else {
            alert("❌ Download Failed: " + (e.message || "Unknown error"));
        }
    }
}

function toggleShareSheet() {
    const sheet = document.getElementById('share-sheet');
    if (!sheet) return;
    if (sheet.style.display === 'none' || !sheet.style.display) {
        sheet.style.display = 'block';
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } else {
        sheet.style.display = 'none';
    }
}

async function getCanvasBlob() {
    return new Promise(resolve => {
        canvas.toBlob(blob => resolve(blob), 'image/png');
    });
}

async function shareImageToApp(appName) {
    if (subConfig.price > 0 && !isSubscribed) {
        togglePaymentModal(true);
        return;
    }

    const btn = event.currentTarget;
    const originalContent = btn.innerHTML;

    try {
        // 1. Show processing state
        btn.innerHTML = `<div class="loader" style="width:20px; height:20px; border-width:2px; border-top-color:#fff;"></div>`;
        btn.style.pointerEvents = 'none';

        // 2. Generate Image
        const dataUrl = canvas.toDataURL('image/png', 0.9);
        saveToGallery(dataUrl);

        // 3. Detect Mobile vs Desktop
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        if (isMobile && navigator.share) {
            // Convert DataURL to Blob for sharing
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            const file = new File([blob], 'status.png', { type: 'image/png' });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'Crafto Status',
                    text: 'Created with Crafto Status Maker'
                });
                toggleShareSheet();
            } else {
                throw new Error("Can't share files");
            }
        } else {
            // Desktop Fallback: Download + Alert
            const link = document.createElement('a');
            link.download = `crafto-${Date.now()}.png`;
            link.href = dataUrl;
            link.click();

            toggleShareSheet();
            alert(`✅ Image Downloaded!\n\nPlease open ${appName} and select the downloaded image from your gallery.`);
        }
    } catch (e) {
        console.error("Share failed:", e);
        // Universal fallback
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = 'status.png';
        link.click();
        alert("Image saved to gallery! Please share it manually.");
    } finally {
        btn.innerHTML = originalContent;
        btn.style.pointerEvents = 'auto';
    }
}

function shareToWhatsApp() { shareImageToApp('WhatsApp'); }
function shareToInstagram() { shareImageToApp('Instagram'); }
function shareToFacebook() { shareImageToApp('Facebook'); }
function shareToTelegram() { shareImageToApp('Telegram'); }
function shareGeneric() { shareImageToApp('your favorite app'); }

// --- SUBSCRIPTION LOGIC ---
async function loadSubscriptionConfig() {
    db.collection('config').doc('subscription').onSnapshot(doc => {
        if (doc.exists) {
            subConfig = doc.data();
            updatePaymentUI();
        }
    });
}

function checkSubscriptionStatus() {
    const phone = localStorage.getItem('user_phone');
    if (!phone) return;

    db.collection('subscriptions').where('phone', '==', phone).where('status', '==', 'active').onSnapshot(snap => {
        isSubscribed = !snap.empty;
        const subBadge = document.getElementById('profile-sub-badge');
        const freeBadge = document.getElementById('profile-free-badge');

        if (subBadge) subBadge.style.display = isSubscribed ? 'inline-block' : 'none';
        if (freeBadge) freeBadge.style.display = isSubscribed ? 'none' : 'inline-block';

        // If price is 0, everyone is "subscribed"
        if (subConfig.price === 0) {
            isSubscribed = true;
            if (subBadge) subBadge.style.display = 'inline-block';
            if (freeBadge) freeBadge.style.display = 'none';
        }
    });
}

function updatePaymentUI() {
    const price = subConfig.price || 0;
    const upiId = subConfig.upiId || '';
    const name = subConfig.planName || 'Crafto Pro';
    const merchant = subConfig.merchantName || 'Crafto App';

    const payAmount = document.getElementById('pay-amount');
    const payPlan = document.getElementById('pay-plan-name');
    if (payAmount) payAmount.innerText = `₹${price}`;
    if (payPlan) payPlan.innerText = `Upgrade to ${name}`;

    // UPI URL generation: upi://pay?pa=UPIID&pn=NAME&am=AMOUNT&cu=INR
    const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(merchant)}&am=${price}&cu=INR`;

    const gpay = document.getElementById('gpay-link');
    const phonepe = document.getElementById('phonepe-link');
    const paytm = document.getElementById('paytm-link');

    if (gpay) gpay.href = upiUrl;
    if (phonepe) phonepe.href = upiUrl;
    if (paytm) paytm.href = upiUrl;

    // If price is 0, auto-subscribe everyone (visual only)
    if (price === 0) isSubscribed = true;
}

function togglePaymentModal(show) {
    const modal = document.getElementById('payment-modal');
    if (modal) modal.style.display = show ? 'flex' : 'none';
    if (show) updatePaymentUI();
}

async function submitPayment() {
    const txnIdInput = document.getElementById('txn-id-input');
    const submitBtn = document.querySelector('button[onclick="submitPayment()"]');
    const txnId = txnIdInput.value.trim();
    const phone = localStorage.getItem('user_phone');

    if (!phone) {
        alert('❌ SESSION EXPIRED: Please Login again to continue with the upgrade.');
        switchView('profile-view');
        togglePaymentModal(false);
        return;
    }

    if (!txnId || txnId.length < 6) {
        alert('❌ INVALID ID: Please enter a valid Transaction ID / UTR (usually 12 digits) from your payment app.');
        return;
    }

    try {
        const originalText = submitBtn.innerText;
        submitBtn.innerText = "⏳ Verifying...";
        submitBtn.disabled = true;

        await db.collection('subscriptions').add({
            phone: phone,
            transactionId: txnId,
            amount: subConfig.price,
            planName: subConfig.planName,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert('✅ PAYMENT SUBMITTED!\n\nYour details have been sent to the admin for manual verification. Your account will be activated within 2-4 hours.\n\nYou will see the "PRO" badge in your profile once approved.');
        togglePaymentModal(false);
        txnIdInput.value = '';
    } catch (e) {
        console.error("Subscription submission failed:", e);
        alert('❌ SYSTEM ERROR: Could not submit payment details. Error: ' + e.message);
    } finally {
        submitBtn.innerText = "Verify Payment";
        submitBtn.disabled = false;
    }
}

async function recordVideo(mode = 'download') {
    if (!canvas || !videoEl) {
        throw new Error("No video element found");
    }

    const overlay = document.getElementById('processing-overlay');
    const statusText = document.getElementById('processing-status');

    try {
        overlay.style.display = 'flex';
        statusText.innerText = "Initializing recorder...";

        // 1. Initial Checks
        if (videoEl.readyState < 2) {
            statusText.innerText = "Waiting for video data...";
            await new Promise((res, rej) => {
                const timeout = setTimeout(() => rej(new Error("Video load timeout")), 5000);
                videoEl.onloadeddata = () => { clearTimeout(timeout); res(); };
            });
        }

        // 2. Setup Recorder
        const stream = canvas.captureStream(30);
        const recorder = new MediaRecorder(stream, {
            mimeType: 'video/webm;codecs=vp9',
            videoBitsPerSecond: 5000000
        });

        const chunks = [];
        recorder.ondataavailable = e => chunks.push(e.data);

        return new Promise(async (resolve, reject) => {
            const safetyTimeout = setTimeout(() => {
                if (recorder.state === 'recording') recorder.stop();
                reject(new Error("Recording timed out"));
            }, 15000); // 15s absolute limit

            recorder.onstop = async () => {
                clearTimeout(safetyTimeout);
                try {
                    const blob = new Blob(chunks, { type: 'video/webm' });
                    const url = URL.createObjectURL(blob);
                    const fileName = `crafto-video-${Date.now()}.webm`;
                    const thumbUrl = canvas.toDataURL('image/jpeg', 0.7);
                    saveToGallery(thumbUrl);

                    if (mode === 'share') {
                        const file = new File([blob], fileName, { type: 'video/webm' });
                        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                            await navigator.share({ files: [file], title: 'My Video', text: 'Created with Crafto' });
                        } else {
                            const a = document.createElement('a');
                            a.href = url; a.download = fileName; a.click();
                            alert("Sharing not supported, video downloaded instead!");
                        }
                    } else {
                        const a = document.createElement('a');
                        a.href = url; a.download = fileName; a.click();
                        alert("✅ Video successfully saved to your downloads!");
                    }
                    resolve();
                } catch (e) {
                    reject(e);
                } finally {
                    overlay.style.display = 'none';
                }
            };

            recorder.onerror = e => reject(e);

            // 3. Start Playback & Recording
            videoEl.currentTime = 0;
            await videoEl.play().catch(e => reject(new Error("Playback blocked: " + e.message)));
            recorder.start();

            let duration = videoEl.duration || 5;
            if (duration > 15) duration = 15;

            let elapsed = 0;
            const interval = setInterval(() => {
                elapsed += 0.5;
                const progress = Math.round((elapsed / duration) * 100);
                statusText.innerText = `Rendering: ${Math.min(progress, 100)}%`;

                if (elapsed >= duration || recorder.state === 'inactive') {
                    clearInterval(interval);
                    if (recorder.state === 'recording') recorder.stop();
                }
            }, 500);
        });

    } catch (err) {
        console.error("Recording error:", err);
        overlay.style.display = 'none';
        throw err;
    }
}

function saveToGallery(dataUrl) {
    let saved = JSON.parse(localStorage.getItem('crafto_saved_designs') || '[]');
    saved.unshift({
        id: Date.now(),
        image: dataUrl,
        date: new Date().toLocaleDateString()
    });
    if (saved.length > 50) saved.pop();
    localStorage.setItem('crafto_saved_designs', JSON.stringify(saved));
}

function showGallery() {
    document.getElementById('profile-view').style.display = 'none';
    document.getElementById('gallery-view').style.display = 'flex';
    renderGallery();
}

function hideGallery() {
    document.getElementById('gallery-view').style.display = 'none';
    document.getElementById('profile-view').style.display = 'flex';
}

function renderGallery() {
    const grid = document.getElementById('gallery-grid');
    const saved = JSON.parse(localStorage.getItem('crafto_saved_designs') || '[]');

    grid.innerHTML = '';

    if (saved.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 60px; color: var(--text-muted);">
            <i data-lucide="image" style="width: 48px; height: 48px; margin-bottom: 15px; opacity: 0.3;"></i>
            <p>No saved designs yet.</p>
        </div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    saved.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'gallery-item';
        div.innerHTML = `
            <img src="${item.image}">
            <div class="gallery-item-actions">
                <i data-lucide="share-2" onclick="shareSaved(${index})"></i>
                <i data-lucide="download" onclick="downloadSaved(${index})"></i>
                <i data-lucide="trash-2" onclick="deleteSaved(${index})" style="color: #ef4444;"></i>
            </div>
        `;
        grid.appendChild(div);
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function downloadSaved(index) {
    const saved = JSON.parse(localStorage.getItem('crafto_saved_designs') || '[]');
    const item = saved[index];
    const link = document.createElement('a');
    link.download = `crafto-saved-${item.id}.png`;
    link.href = item.image;
    link.click();
}

function deleteSaved(index) {
    if (confirm('Delete this saved design?')) {
        let saved = JSON.parse(localStorage.getItem('crafto_saved_designs') || '[]');
        saved.splice(index, 1);
        localStorage.setItem('crafto_saved_designs', JSON.stringify(saved));
        renderGallery();
    }
}

function clearGallery() {
    if (confirm('Are you sure you want to clear your entire gallery?')) {
        localStorage.setItem('crafto_saved_designs', '[]');
        renderGallery();
    }
}

async function shareSaved(index) {
    const saved = JSON.parse(localStorage.getItem('crafto_saved_designs') || '[]');
    const item = saved[index];
    const blob = await (await fetch(item.image)).blob();
    const file = new File([blob], 'my-design.png', { type: 'image/png' });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
    } else {
        alert("Native sharing not supported in this browser.");
    }
}

async function shareWhatsApp() {
    if (selectedTemplate && selectedTemplate.type === 'video') {
        recordVideo('share');
    } else {
        const dataUrl = canvas.toDataURL('image/png');
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], 'crafto-status.png', { type: 'image/png' });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    title: 'Check out my Crafto design!',
                    text: 'Created using Crafto - Status & Quote Maker'
                });
            } catch (err) {
                console.warn("Sharing failed:", err);
                promptFallbackShare();
            }
        } else {
            promptFallbackShare();
        }
    }
}

function promptFallbackShare() {
}

// --- CLOUD TEMPLATE LOADING ---
async function loadCloudTemplates() {
    try {
        // Fallback to defaults first while loading
        templates = [...DEFAULT_TEMPLATES];
        renderTemplates();

        // Listen for real-time updates from Firestore
        db.collection('templates').onSnapshot((snapshot) => {
            const cloudTemplates = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            if (cloudTemplates.length > 0) {
                // Merge or replace based on preference
                templates = [...cloudTemplates];
                renderTemplates();
                console.log("Cloud Templates Loaded:", cloudTemplates.length);
            }
        });
    } catch (error) {
        console.error("Cloud Loading Error:", error);
    }
}

