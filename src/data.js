export const me = {
  name: 'Ayesha',
  username: '@ayesha_live',
  age: 24,
  email: 'host@mail.com',
  languages: 'Hindi, English',
  bio: 'Late night chats, music and good vibes 💜',
  rating: 4.8,
  calls: 126,
  followers: '8.4k',
  talkTime: '28h',
  gifts: '1.1k',
  videoRate: 24,
  voiceRate: 12,
  privateLiveRate: 30,
  balanceRupees: 1840,
  beans: 62400,
  availableBalance: 12480,
}

export const conversations = [
  { id: 'rahul', name: 'Rahul', last: 'See you tonight at 9?', time: '2m', unread: true, level: 4, online: true },
  { id: 'neel', name: 'Neel', last: 'Sent you a Rose 🌹', time: '18m', unread: true, level: 2, online: true },
  { id: 'karan', name: 'Karan', last: 'Thanks for the call!', time: '1h', unread: true, level: 3 },
  { id: 'dev', name: 'Dev', last: 'Are you live today?', time: '3h' },
  { id: 'imran', name: 'Imran', last: 'Good morning ☀️', time: '1d' },
  { id: 'aman', name: 'Aman', last: 'Loved the stream', time: '2d' },
]

export const messages = {
  rahul: [
    { me: false, t: 'Hey! Are you free for a quick call?', at: '9:02 PM' },
    { me: true, t: 'Yes, going online in 5 minutes ✨', at: '9:03 PM' },
    { me: false, t: "Perfect, I'll wait.", at: '9:04 PM' },
    { gift: 'Rahul sent Heart · 120 beans' },
    { me: true, t: 'Thank you so much! 💗', at: '9:06 PM' },
  ],
  neel: [
    { me: false, t: 'Hey! Are you free for a quick call?', at: '9:02 PM' },
    { me: true, t: 'Yes, going online in 5 minutes ✨', at: '9:03 PM' },
    { me: false, t: "Perfect, I'll wait.", at: '9:04 PM' },
    { gift: 'Neel sent you Rose · 320 beans' },
  ],
}

export const callLog = [
  { day: 'Today', items: [
    { name: 'Rahul', kind: 'Video call', dur: '12:04', amount: 320, time: '9:12 PM' },
    { name: 'Dev', kind: 'Voice call', dur: '04:20', amount: 96, time: '8:40 PM' },
    { name: 'Imran', kind: 'Missed video call', missed: true, time: '7:58 PM' },
  ]},
  { day: 'Yesterday', items: [
    { name: 'Karan', kind: 'Video call', dur: '22:41', amount: 610, time: '10:04 PM' },
    { name: 'Neel', kind: 'Video call', dur: '08:12', amount: 218, time: '9:20 PM' },
  ]},
]

export const queue = [
  { name: 'Karan', kind: 'Video', status: 'Ready' },
  { name: 'Dev', kind: 'Voice', status: '2nd' },
]

export const gifts = [
  { key: 'rose', label: 'Rose', beans: 250, emoji: '🌹' },
  { key: 'heart', label: 'Heart', beans: 120, emoji: '❤️' },
  { key: 'giftbox', label: 'Gift box', beans: 500, emoji: '🎁' },
  { key: 'crown', label: 'Crown', beans: 2100, emoji: '👑' },
  { key: 'rocket', label: 'Rocket', beans: 1050, emoji: '🚀' },
  { key: 'diamond', label: 'Diamond', beans: 4200, emoji: '💎' },
]

export const topGifters = [
  { name: 'Neel', gift: 'Crown ×2', beans: 4200 },
  { name: 'Aman', gift: 'Rocket ×1', beans: 2100 },
]

export const notifications = [
  { group: 'Today', items: [
    { icon: 'wallet', tone: 'gold', title: 'Withdrawal paid', sub: '₹ 9,800 credited to HDFC •••• 4821', time: '11:02 AM', tag: 'New' },
    { avatar: 'Neel', title: 'Neel sent you a Crown', sub: '2,100 beans', time: '9:02 AM', tag: 'New' },
    { icon: 'phone', tone: 'brand', title: 'Missed call from Imran', sub: 'Tap to call back', time: '7:58 AM', tag: 'New', tagTone: 'rose' },
  ]},
  { group: 'Earlier', items: [
    { icon: 'shield-check', tone: 'green', title: 'KYC approved', sub: 'Payouts are now enabled', time: '14 Aug' },
    { icon: 'sparkles', tone: 'brand', title: "You're trending", sub: 'Top 5% hosts this week', time: '12 Aug' },
    { icon: 'shield', tone: 'gold', title: 'Community guidelines updated', sub: '', time: '10 Aug' },
  ]},
]

export const earningsHistory = [
  { day: 'Today', items: [
    { icon: 'phone', title: 'Video call · Rahul', sub: '12:04 · 9:12 PM', amount: 320 },
    { icon: 'gift', title: 'Gift · Crown from Neel', sub: '9:02 PM', amount: 210 },
    { icon: 'phone', title: 'Voice call · Dev', sub: '04:20 · 8:40 PM', amount: 96 },
  ]},
  { day: 'Yesterday', items: [
    { icon: 'live', title: 'Live stream', sub: '48 min · 1.2k viewers', amount: 4210 },
    { icon: 'phone', title: 'Video call · Karan', sub: '22:41 · 10:04 PM', amount: 610 },
    { icon: 'gift', title: 'Gift · Rocket from Aman', sub: '9:44 PM', amount: 105 },
  ]},
]

export const reportReasons = [
  'Nudity or sexual content',
  'Abusive language',
  'Harassment or threats',
  'Asking to move off-platform',
  'Underage user',
  'Something else',
]
