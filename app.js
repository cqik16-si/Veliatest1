import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getDatabase, ref, onValue, set, push, update, remove, get } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";
import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";

// --- CONFIG ---
const firebaseConfig = {
     apiKey: "",
  authDomain: "veliareal.firebaseapp.com",
  projectId: "veliareal",
  storageBucket: "veliareal.firebasestorage.app",
  messagingSenderId: "501436683148",
  appId: "1:501436683148:web:5be811f367c4a8187f3ca9",
  measurementId: "G-5030G060R4"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const storage = getStorage(app);

let currentUser = null;
let currentUsername = null;
let currentBio = null;
let currentPhotoUrl = null;
let currentChatId = null;
const genericImage = "https://placehold.co/600x400/7c3aed/ffffff?text=Conversation"; 

// --- AUTH ---
document.getElementById('btn-google-login').addEventListener('click', () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider)
        .catch((error) => {
            console.error("Google Sign-In Error:", error);
            document.getElementById('login-error').innerText = "Failed to sign in. Try again.";
        });
});

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const userRef = ref(db, 'users/' + user.uid);
        const snap = await get(userRef);
        
        if(!snap.exists()) {
            let baseName = user.displayName || user.email.split('@')[0];
            let safeName = baseName.replace(/\./g, '_').replace(/[^a-zA-Z0-9_]/g, '');
            await set(userRef, { username: safeName, email: user.email, bio: "Hey! I'm using Velia.", photoUrl: user.photoURL || null });
            await set(ref(db, 'usernames/' + safeName), true);
        } 

        onValue(userRef, (snap) => {
            if(snap.exists()) {
                const data = snap.val();
                currentUsername = data.username;
                currentBio = data.bio || "No bio yet.";
                currentPhotoUrl = data.photoUrl;
                updateProfileUI();
            }
            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('app-screen').classList.remove('hidden');
            switchTab('home');
        });

    } else {
        currentUser = null;
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('app-screen').classList.add('hidden');
    }
});

// --- PROFILE ---
window.toggleProfileMenu = function() { document.getElementById('profile-dropdown').classList.toggle('hidden'); }
window.handleLogout = function() { signOut(auth); window.toggleProfileMenu(); }

window.openEditProfileModal = function() {
    window.toggleProfileMenu();
    document.getElementById('edit-profile-modal').classList.remove('hidden');
    document.getElementById('edit-username-input').value = currentUsername;
    document.getElementById('edit-bio-input').value = currentBio === "No bio yet." ? "" : currentBio;
}

document.getElementById('btn-cancel-edit-profile').addEventListener('click', () => { document.getElementById('edit-profile-modal').classList.add('hidden'); });

document.getElementById('btn-save-edit-profile').addEventListener('click', async () => {
    const newName = document.getElementById('edit-username-input').value.trim();
    const newBio = document.getElementById('edit-bio-input').value.trim();
    const errorBox = document.getElementById('edit-profile-error');
    if (newName === currentUsername && newBio === (currentBio === "No bio yet." ? "" : currentBio)) { document.getElementById('edit-profile-modal').classList.add('hidden'); return; }
    if (newName.length < 3) return alert("Username too short");
    errorBox.innerText = "Updating...";
    try {
        if (newName !== currentUsername) {
            const snap = await get(ref(db, 'usernames/' + newName));
            if(snap.exists()) { errorBox.innerText = "Username already taken."; return; }
            await update(ref(db, 'users/' + currentUser.uid), { username: newName });
            await set(ref(db, 'usernames/' + newName), true);
            await remove(ref(db, 'usernames/' + currentUsername));
            currentUsername = newName;
        }
        await update(ref(db, 'users/' + currentUser.uid), { bio: newBio });
        currentBio = newBio;
        updateProfileUI();
        document.getElementById('edit-profile-modal').classList.add('hidden');
        errorBox.innerText = "";
    } catch(e) { errorBox.innerText = e.message; }
});

// --- VIEW PROFILE ---
window.viewUserProfile = async function(hostId) {
    if(hostId === currentUser.uid) return;
    try {
        const snap = await get(ref(db, 'users/' + hostId));
        if(snap.exists()) {
            const data = snap.val();
            const viewAvatar = document.getElementById('view-profile-modal').querySelector('.profile-view-avatar');
            const viewName = document.getElementById('view-profile-name');
            const viewBio = document.getElementById('view-profile-bio');
            if(data.photoUrl) viewAvatar.innerHTML = `<img src="${data.photoUrl}" alt="Profile">`;
            else viewAvatar.innerText = data.username.substring(0,2).toUpperCase();
            viewName.innerText = data.username;
            viewBio.innerText = data.bio || "This user hasn't added a bio yet.";
            document.getElementById('view-profile-modal').classList.remove('hidden');
        } else { alert("User profile not found."); }
    } catch(e) { console.error(e); alert("Error loading profile."); }
}

window.closeViewProfile = function() { document.getElementById('view-profile-modal').classList.add('hidden'); }

function updateProfileUI() {
    const avatar = document.getElementById('header-avatar');
    if(currentPhotoUrl) avatar.innerHTML = `<img src="${currentPhotoUrl}" alt="Profile">`;
    else avatar.innerText = currentUsername ? currentUsername.substring(0,2).toUpperCase() : "U";
}

// --- NAVIGATION ---
window.switchTab = function(tab) {
    document.getElementById('view-home').classList.add('hidden');
    document.getElementById('view-plan').classList.add('hidden');
    document.getElementById('view-chat-list').classList.add('hidden');
    document.getElementById('view-chat').classList.add('hidden');
    document.getElementById('btn-create-fab').classList.add('hidden');
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById('profile-dropdown').classList.add('hidden');
    document.getElementById('btn-follow-chat').style.display = 'none';

    if (tab === 'home') {
        document.getElementById('view-home').classList.remove('hidden');
        document.getElementById('btn-create-fab').classList.remove('hidden');
        document.querySelectorAll('.nav-item')[0].classList.add('active');
        loadHome();
    } else if (tab === 'plan') {
        document.getElementById('view-plan').classList.remove('hidden');
        document.querySelectorAll('.nav-item')[1].classList.add('active');
        loadPlan();
    } else if (tab === 'chat') {
        document.getElementById('view-chat-list').classList.remove('hidden');
        document.querySelectorAll('.nav-item')[2].classList.add('active');
        loadChatList();
    }
}

// --- CREATE INVITE ---
const modal = document.getElementById('create-modal');
document.getElementById('btn-create-fab').onclick = () => modal.classList.remove('hidden');
document.getElementById('btn-cancel-create').onclick = () => { modal.classList.add('hidden'); document.getElementById('new-title').value = ''; document.getElementById('new-date').value = ''; };

document.getElementById('btn-save-invite').addEventListener('click', async () => {
    const title = document.getElementById('new-title').value;
    const dateVal = document.getElementById('new-date').value;
    if (!title || !dateVal) return alert("Fill all fields");

    const selectedDate = new Date(dateVal);
    const now = new Date();
    if (selectedDate < now) return alert("You cannot create an invite for a past date.");

    await set(push(ref(db, 'invites')), { title, date: dateVal, image: genericImage, isBooked: false, hostId: currentUser.uid, hostName: currentUsername });
    modal.classList.add('hidden');
    alert("Invite posted!");
});

// --- CLEANUP HELPER ---
async function deletePastUnbookedInvites() {
    if(!currentUser) return;
    const now = new Date();
    try {
        const snap = await get(ref(db, 'invites'));
        if(!snap.exists()) return;
        snap.forEach(child => {
            const invite = child.val();
            const inviteDate = new Date(invite.date);
            if (inviteDate < now && !invite.isBooked) {
                if(invite.hostId === currentUser.uid) remove(ref(db, 'invites/' + child.key));
            }
        });
    } catch(e) { console.error("Cleanup error:", e); }
}

// --- HOME ---
async function loadHome() {
    await deletePastUnbookedInvites();
    const list = document.getElementById('invite-list');
    list.innerHTML = "";
    try {
        const snap = await get(ref(db, 'invites'));
        if(!snap.exists()) return list.innerHTML = "<p style='text-align:center; padding:20px'>No invites.</p>";
        snap.forEach(child => {
            const invite = child.val();
            const inviteDate = new Date(invite.date);
            const now = new Date();
            if(invite.isBooked) return; 
            if(invite.hostId === currentUser.uid) return;
            if(inviteDate < now) return;
            renderCard(invite, child.key, list, 'home');
        });
    } catch(e) { console.error("Error loading home:", e); }
}

// --- MY PLAN ---
async function loadPlan() {
    const list = document.getElementById('plan-list');
    list.innerHTML = "";
    try {
        const followingSnap = await get(ref(db, 'following/' + currentUser.uid));
        const followingList = followingSnap.exists() ? Object.keys(followingSnap.val()) : [];
        const snap = await get(ref(db, 'invites'));
        if(!snap.exists()) return list.innerHTML = "<p style='text-align:center; padding:20px'>No plans yet.</p>";
        snap.forEach(child => {
            const invite = child.val();
            const inviteDate = new Date(invite.date);
            const now = new Date();
            const isMyInvite = invite.hostId === currentUser.uid;
            const isBookedByMe = invite.guestId === currentUser.uid;
            const isFollowingHost = followingList.includes(invite.hostId);
            if (isMyInvite || isBookedByMe || isFollowingHost) {
                if(inviteDate < now && !invite.isBooked) return;
                renderCard(invite, child.key, list, 'plan');
            }
        });
    } catch(e) { console.error("Error loading plan:", e); }
}

// --- CHAT LIST ---
async function loadChatList() {
    const list = document.getElementById('chat-list-container');
    list.innerHTML = "";
    try {
        const snap = await get(ref(db, 'invites'));
        if(!snap.exists()) return list.innerHTML = "<p style='text-align:center; padding:20px'>No chats yet.</p>";
        const promises = [];
        snap.forEach(child => {
            const invite = child.val();
            if (invite.isBooked && (invite.hostId === currentUser.uid || invite.guestId === currentUser.uid)) {
                promises.push(checkUnreadStatus(child.key, invite).then(isUnreadObj => { renderCard(invite, child.key, list, 'chat', isUnreadObj); }));
            }
        });
        await Promise.all(promises);
    } catch(e) { console.error("Error loading chat list:", e); }
}

// Helper: Check Unread Status
async function checkUnreadStatus(inviteKey, invite) {
    const isHost = invite.hostId === currentUser.uid;
    const otherName = isHost ? invite.guestName : invite.hostName;
    const lastReadKey = `read_${inviteKey}_${currentUser.uid}`;
    const lastReadTime = localStorage.getItem(lastReadKey);
    const msgSnap = await get(ref(db, 'messages/' + inviteKey));
    let isUnread = false;
    if (msgSnap.exists()) {
        const messages = Object.values(msgSnap.val());
        const lastMsg = messages[messages.length - 1]; 
        if (lastMsg && (!lastReadTime || (lastMsg.timestamp > parseInt(lastReadTime)))) isUnread = true;
    }
    return { isUnread, otherName };
}

// --- RENDER CARD ---
function renderCard(invite, key, container, mode, isUnreadObj) {
    const d = new Date(invite.date);
    const dateStr = d.toLocaleString();
    const isHost = invite.hostId === currentUser.uid;
    const isGuest = invite.guestId === currentUser.uid;
    const hostName = invite.hostName || "Unknown";
    let unreadHtml = (mode === 'chat' && isUnreadObj && isUnreadObj.isUnread) ? `<span class="unread-dot"></span>` : "";
    let xBtnHtml = '';
    if (isHost) xBtnHtml = `<button class="btn-x" onclick="cancelInviteHost('${key}')">X</button>`;
    else if (isGuest) xBtnHtml = `<button class="btn-x" onclick="cancelBooking('${key}')">X</button>`;
    let btnHtml = ''; let displayTitle = invite.title; let cardClass = "card";
    if (mode === 'chat') {
        btnHtml = `<button class="btn-book" onclick="enterChat('${key}')">Chat</button>`;
        displayTitle = isUnreadObj && isUnreadObj.otherName ? `Chat with ${isUnreadObj.otherName}` : invite.title;
        if (isUnreadObj && isUnreadObj.isUnread) cardClass += " unread"; 
    } else {
        if (isHost) btnHtml = invite.isBooked ? `<button class="btn-book" onclick="enterChat('${key}')">Chat Now</button>` : `<button class="btn-book" disabled>No guest yet</button>`;
        else if (isGuest) btnHtml = invite.isBooked ? `<button class="btn-book" onclick="enterChat('${key}')">Chat Now</button>` : `<button class="btn-book" disabled>Waiting</button>`;
        else btnHtml = `<button class="btn-book" onclick="bookMeeting('${key}')">Looking to connect</button>`;
    }
    if (document.getElementById(`card-${key}`)) return;
    container.innerHTML += `<div id="card-${key}" class="${cardClass}"><img src="${invite.image}" alt="img">${xBtnHtml}<div class="card-body"><h3>${displayTitle}</h3>${!isHost ? `<p class="host-name" onclick="viewUserProfile('${invite.hostId}')">Hosted by ${hostName}</p>` : `<p class="host-name" style="color:#333; cursor:default;">Your Invite</p>`}<p class="date">${dateStr}</p>${btnHtml}${unreadHtml}</div></div>`;
}

// --- ACTIONS ---
window.bookMeeting = async function(key) {
    const inviteSnap = await get(ref(db, 'invites/' + key));
    if(!inviteSnap.exists()) return;
    const invite = inviteSnap.val();
    if(new Date(invite.date) < new Date()) { alert("This event has already passed."); return; }
    if(!confirm("Book this?")) return;
    await update(ref(db, 'invites/' + key), { isBooked: true, guestId: currentUser.uid, guestName: currentUsername });
    alert("Booked!");
    loadHome();
}
window.cancelInviteHost = function(key) { if(confirm("Delete this invite?")) { remove(ref(db, 'invites/' + key)); loadPlan(); } }
window.cancelBooking = async function(key) { if(confirm("Cancel booking?")) { await update(ref(db, 'invites/' + key), { isBooked: false, guestId: null }); alert("Cancelled."); loadPlan(); } }

// --- FOLLOW LOGIC ---
async function checkFollowStatus(otherUserId) {
    try {
        const snap = await get(ref(db, `following/${currentUser.uid}/${otherUserId}`));
        return snap.exists();
    } catch(e) { return false; }
}

window.toggleFollow = async function(otherUserId) {
    try {
        const isFollowing = await checkFollowStatus(otherUserId);
        const btn = document.getElementById('btn-follow-chat');
        if (isFollowing) {
            await remove(ref(db, `following/${currentUser.uid}/${otherUserId}`));
            btn.innerText = "Follow";
            btn.classList.remove('following');
        } else {
            await set(ref(db, `following/${currentUser.uid}/${otherUserId}`), true);
            btn.innerText = "Following";
            btn.classList.add('following');
        }
    } catch(e) { console.error(e); alert("Could not update status."); }
}

// --- FOLLOWING MODAL ---
window.openFollowingModal = async function() {
    window.toggleProfileMenu();
    const modal = document.getElementById('following-modal');
    const list = document.getElementById('following-list-container');
    list.innerHTML = "Loading...";
    modal.classList.remove('hidden');

    try {
        const snap = await get(ref(db, 'following/' + currentUser.uid));
        if(!snap.exists()) {
            list.innerHTML = "<p style='text-align:center; padding:20px; color:#666;'>You are not following anyone yet.</p>";
            return;
        }
        
        list.innerHTML = "";
        const uids = Object.keys(snap.val());
        
        for (let uid of uids) {
            const userSnap = await get(ref(db, 'users/' + uid));
            if(userSnap.exists()) {
                const data = userSnap.val();
                const avatarHtml = data.photoUrl ? `<img src="${data.photoUrl}" />` : data.username.substring(0,2).toUpperCase();
                list.innerHTML += `
                    <div class="following-item" id="follow-item-${uid}">
                        <div class="following-info">
                            <div class="following-avatar">${avatarHtml}</div>
                            <span class="following-name">${data.username}</span>
                        </div>
                        <button class="btn-unfollow" onclick="unfollowUser('${uid}')">Unfollow</button>
                    </div>
                `;
            }
        }
    } catch(e) {
        console.error(e);
        list.innerHTML = "<p style='color:red; text-align:center;'>Error loading list.</p>";
    }
}

window.unfollowUser = async function(targetUid) {
    if(!confirm("Unfollow this user?")) return;
    await remove(ref(db, `following/${currentUser.uid}/${targetUid}`));
    const item = document.getElementById(`follow-item-${targetUid}`);
    if(item) item.remove();
    
    const list = document.getElementById('following-list-container');
    if(list.children.length === 0) {
        list.innerHTML = "<p style='text-align:center; padding:20px; color:#666;'>You are not following anyone yet.</p>";
    }
}

window.closeFollowingModal = function() {
    document.getElementById('following-modal').classList.add('hidden');
}

// --- CHAT ROOM ---
window.enterChat = async function(inviteKey) {
    if(!inviteKey) return;
    currentChatId = inviteKey;
    localStorage.setItem(`read_${inviteKey}_${currentUser.uid}`, Date.now());

    document.getElementById('view-home').classList.add('hidden');
    document.getElementById('view-plan').classList.add('hidden');
    document.getElementById('view-chat-list').classList.add('hidden');
    document.getElementById('view-chat').classList.remove('hidden');
    document.getElementById('bottom-nav').style.display = 'none';

    const inviteSnap = await get(ref(db, 'invites/' + inviteKey));
    if(!inviteSnap.exists()) { alert("Error: Invite not found."); return; }
    
    const invite = inviteSnap.val();
    const isHost = invite.hostId === currentUser.uid;
    const otherUserId = isHost ? invite.guestId : invite.hostId;
    const otherName = isHost ? invite.guestName : invite.hostName;
    
    document.getElementById('chat-title').innerText = otherName ? `Chat with ${otherName}` : "Chat";

    const followBtn = document.getElementById('btn-follow-chat');
    try {
        if(otherUserId) {
            followBtn.style.display = 'block';
            const isFollowing = await checkFollowStatus(otherUserId);
            followBtn.innerText = isFollowing ? "Following" : "Follow";
            followBtn.classList.toggle('following', isFollowing);
            followBtn.onclick = () => toggleFollow(otherUserId);
        } else followBtn.style.display = 'none';
    } catch(e) { followBtn.style.display = 'none'; }

    onValue(ref(db, 'messages/' + inviteKey), (msgSnap) => {
        const box = document.getElementById('chat-messages');
        box.innerHTML = "";
        if(!msgSnap.exists()) { box.innerHTML = "<p style='text-align:center; color:#ccc; margin-top:50px;'>Start of conversation</p>"; return; }
        msgSnap.forEach(msg => {
            const data = msg.val();
            const isMine = (data.senderId === currentUser.uid);
            const msgClass = isMine ? 'mine' : 'theirs';
            const delBtn = isMine ? `<button class="btn-msg-delete" onclick="deleteMessage('${msg.key}')">✖</button>` : '';
            box.innerHTML += `<div class="message ${msgClass}">${data.text}${delBtn}</div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
}

document.getElementById('btn-back-chat').onclick = () => {
    document.getElementById('view-chat').classList.add('hidden');
    document.getElementById('bottom-nav').style.display = 'flex';
    currentChatId = null;
    document.getElementById('btn-follow-chat').style.display = 'none'; 
    switchTab('chat'); 
};

document.getElementById('btn-send').onclick = async () => {
    const text = document.getElementById('msg-input').value;
    if (!text) return;
    try {
        await push(ref(db, 'messages/' + currentChatId), { text, senderId: currentUser.uid, timestamp: Date.now() });
        document.getElementById('msg-input').value = "";
    } catch(e) { console.error(e); alert("Failed to send."); }
};

window.deleteMessage = function(msgKey) { if(confirm("Delete this message?")) remove(ref(db, 'messages/' + currentChatId + '/' + msgKey)); }

document.getElementById('btn-delete-chat').onclick = function() { if(confirm("Clear entire conversation history?")) { remove(ref(db, 'messages/' + currentChatId)); document.getElementById('chat-messages').innerHTML = ""; } }
