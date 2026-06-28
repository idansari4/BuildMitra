import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { storage } from "@/src/utils/storage";

export type Lang = "en" | "hi";

const dict: Record<string, { en: string; hi: string }> = {
  // Common
  "app.tagline": { en: "India's Construction Network", hi: "भारत का निर्माण नेटवर्क" },
  "common.continue": { en: "Continue", hi: "आगे बढ़ें" },
  "common.back": { en: "Back", hi: "वापस" },
  "common.save": { en: "Save", hi: "सेव करें" },
  "common.logout": { en: "Logout", hi: "लॉग आउट" },
  "common.cancel": { en: "Cancel", hi: "रद्द करें" },
  "common.loading": { en: "Loading...", hi: "लोड हो रहा है..." },
  "common.failed": { en: "Failed", hi: "असफल" },
  "common.saved": { en: "Saved ✓", hi: "सहेजा गया ✓" },
  "common.search": { en: "Search", hi: "खोजें" },
  "common.all": { en: "All", hi: "सभी" },
  "common.verified": { en: "Verified", hi: "सत्यापित" },
  "common.notVerified": { en: "Not verified", hi: "सत्यापित नहीं" },
  "common.urgent": { en: "Urgent", hi: "तत्काल" },
  "common.normal": { en: "Normal", hi: "सामान्य" },
  "common.perDay": { en: "per day", hi: "/ दिन" },
  "common.workers": { en: "workers", hi: "श्रमिक" },
  "common.applied": { en: "applied", hi: "आवेदन" },
  "common.days": { en: "days", hi: "दिन" },
  "common.reviews": { en: "reviews", hi: "समीक्षाएं" },

  // Role select
  "role.title": { en: "Welcome to BuildMitra", hi: "BuildMitra में स्वागत है" },
  "role.subtitle": { en: "Tell us who you are to get started", hi: "शुरू करने के लिए बताएं आप कौन हैं" },
  "role.worker": { en: "I am a Worker", hi: "मैं एक श्रमिक हूं" },
  "role.worker.desc": { en: "Find daily-wage construction jobs near you", hi: "आसपास के दैनिक मजदूरी काम खोजें" },
  "role.contractor": { en: "I am a Contractor", hi: "मैं एक ठेकेदार हूं" },
  "role.contractor.desc": { en: "Manage your team, bid on projects", hi: "अपनी टीम मैनेज करें, प्रोजेक्ट पर बोली लगाएं" },
  "role.client": { en: "I am a Client", hi: "मैं एक क्लाइंट हूं" },
  "role.client.desc": { en: "Hire workers or contractor teams", hi: "श्रमिक या ठेकेदार टीम किराए पर लें" },

  // Auth
  "auth.login": { en: "Login", hi: "लॉगिन" },
  "auth.loginSub": { en: "Use your registered mobile number", hi: "अपना पंजीकृत मोबाइल नंबर उपयोग करें" },
  "auth.mobile": { en: "Mobile Number", hi: "मोबाइल नंबर" },
  "auth.mobilePlaceholder": { en: "10-digit mobile", hi: "10 अंकों का मोबाइल" },
  "auth.password": { en: "Password", hi: "पासवर्ड" },
  "auth.demoAccounts": { en: "Demo accounts (password: demo1234)", hi: "डेमो अकाउंट (पासवर्ड: demo1234)" },
  "auth.invalidCreds": { en: "Enter a valid mobile and password (min 4 chars)", hi: "वैध मोबाइल और पासवर्ड दर्ज करें (न्यूनतम 4 अक्षर)" },
  "auth.newHere": { en: "New here?", hi: "नए हैं?" },
  "auth.createAccount": { en: "Create account", hi: "खाता बनाएं" },
  "auth.createTitle": { en: "Create Account", hi: "खाता बनाएं" },
  "auth.joiningAs": { en: "Joining as", hi: "जुड़ रहे हैं" },
  "auth.fullName": { en: "Full Name", hi: "पूरा नाम" },
  "auth.namePlaceholder": { en: "e.g. Ramesh Kumar", hi: "जैसे रमेश कुमार" },
  "auth.minPw": { en: "min 4 chars", hi: "न्यूनतम 4 अक्षर" },
  "auth.fillAll": { en: "Fill all fields. Mobile 10 digits, password 4+ chars.", hi: "सभी फ़ील्ड भरें। मोबाइल 10 अंक, पासवर्ड 4+ अक्षर।" },

  // Home (worker)
  "home.welcomeBack": { en: "Welcome back", hi: "वापस स्वागत है" },
  "home.hi": { en: "Hi", hi: "नमस्ते" },
  "home.ai.title": { en: "AI Job Match", hi: "AI जॉब मैच" },
  "home.ai.loading": { en: "Finding best jobs...", hi: "बेहतरीन जॉब्स खोज रहे हैं..." },
  "home.ai.cta": { en: "Tap to find your best-fit jobs", hi: "अपने लिए सही जॉब्स खोजने के लिए टैप करें" },
  "home.ai.tag": { en: "AI MATCH", hi: "AI मैच" },
  "home.empty.worker": { en: "No jobs found.", hi: "कोई जॉब नहीं मिला।" },
  "home.empty.worker.sub": { en: "Try a different skill.", hi: "दूसरा कौशल आज़माएं।" },
  "home.empty.client": { en: "No jobs posted yet.", hi: "अभी कोई जॉब पोस्ट नहीं किया गया।" },
  "home.empty.client.sub": { en: "Tap + Post Job to begin.", hi: "+ पोस्ट जॉब टैप करें।" },

  // Tabs
  "tab.jobs": { en: "Jobs", hi: "जॉब्स" },
  "tab.home": { en: "Home", hi: "होम" },
  "tab.applied": { en: "Applied", hi: "आवेदन" },
  "tab.myJobs": { en: "My Jobs", hi: "मेरे जॉब्स" },
  "tab.attendance": { en: "Attendance", hi: "उपस्थिति" },
  "tab.post": { en: "Post Job", hi: "जॉब पोस्ट" },
  "tab.wallet": { en: "Wallet", hi: "वॉलेट" },
  "tab.profile": { en: "Profile", hi: "प्रोफ़ाइल" },
  "tab.dashboard": { en: "Dashboard", hi: "डैशबोर्ड" },
  "tab.users": { en: "Users", hi: "यूज़र्स" },
  "tab.complaints": { en: "Complaints", hi: "शिकायतें" },

  // Activity
  "activity.myApplications": { en: "My Applications", hi: "मेरे आवेदन" },
  "activity.myPostedJobs": { en: "My Posted Jobs", hi: "मेरे पोस्ट किए जॉब्स" },
  "activity.empty": { en: "Nothing yet", hi: "अभी कुछ नहीं" },
  "activity.empty.worker": { en: "Apply to jobs to see them here", hi: "जॉब्स के लिए आवेदन करें" },
  "activity.empty.client": { en: "Post a job to get started", hi: "शुरू करने के लिए जॉब पोस्ट करें" },

  // Attendance
  "att.title": { en: "Attendance", hi: "उपस्थिति" },
  "att.sub": { en: "GPS + Selfie verification keeps every check-in secure.", hi: "GPS + सेल्फी से हर चेक-इन सुरक्षित।" },
  "att.location": { en: "1. Location", hi: "1. स्थान" },
  "att.notCaptured": { en: "Not captured", hi: "कैप्चर नहीं किया गया" },
  "att.getGps": { en: "Get GPS", hi: "GPS लें" },
  "att.refetch": { en: "Re-fetch", hi: "फिर लें" },
  "att.selfie": { en: "2. Selfie", hi: "2. सेल्फी" },
  "att.selfieCta": { en: "Tap to capture front-camera selfie", hi: "फ्रंट कैमरा सेल्फी लें" },
  "att.retake": { en: "Retake", hi: "दोबारा लें" },
  "att.checkIn": { en: "Check In", hi: "चेक इन" },
  "att.checkOut": { en: "Check Out", hi: "चेक आउट" },
  "att.recent": { en: "Recent", hi: "हाल के" },
  "att.empty": { en: "No attendance records yet.", hi: "कोई उपस्थिति रिकॉर्ड नहीं।" },
  "att.gpsFirst": { en: "Capture GPS first", hi: "पहले GPS लें" },
  "att.selfieFirst": { en: "Capture selfie first", hi: "पहले सेल्फी लें" },
  "att.checkedIn": { en: "Checked in successfully ✓", hi: "सफलतापूर्वक चेक इन ✓" },
  "att.checkedOut": { en: "Checked out successfully ✓", hi: "सफलतापूर्वक चेक आउट ✓" },
  "att.locDenied": { en: "Location permission denied", hi: "स्थान अनुमति अस्वीकृत" },
  "att.camDenied": { en: "Camera permission denied", hi: "कैमरा अनुमति अस्वीकृत" },
  "att.workerOnly": { en: "Attendance is for workers", hi: "उपस्थिति केवल श्रमिकों के लिए" },

  // Post job
  "post.title": { en: "Post a Job", hi: "जॉब पोस्ट करें" },
  "post.sub": { en: "Reach 1000+ workers nearby", hi: "1000+ नजदीकी श्रमिकों तक पहुंचें" },
  "post.jobTitle": { en: "Job Title", hi: "जॉब शीर्षक" },
  "post.jobTitlePh": { en: "e.g. Mason needed for 2BHK", hi: "जैसे 2BHK के लिए राजमिस्त्री" },
  "post.desc": { en: "Description", hi: "विवरण" },
  "post.descPh": { en: "Scope of work, expectations...", hi: "काम का दायरा, अपेक्षाएं..." },
  "post.skill": { en: "Skill Required", hi: "आवश्यक कौशल" },
  "post.workers": { en: "Workers Needed", hi: "आवश्यक श्रमिक" },
  "post.wage": { en: "Daily Wage (₹)", hi: "दैनिक मजदूरी (₹)" },
  "post.location": { en: "Location", hi: "स्थान" },
  "post.locationPh": { en: "City, Area", hi: "शहर, क्षेत्र" },
  "post.duration": { en: "Duration (days)", hi: "अवधि (दिन)" },
  "post.fill": { en: "Fill title, description, and location", hi: "शीर्षक, विवरण और स्थान भरें" },
  "post.posted": { en: "Job posted ✓", hi: "जॉब पोस्ट हुआ ✓" },
  "post.submit": { en: "Post Job", hi: "जॉब पोस्ट करें" },

  // Wallet
  "wallet.title": { en: "Wallet & Referrals", hi: "वॉलेट और रेफरल" },
  "wallet.earnings": { en: "TOTAL EARNINGS", hi: "कुल कमाई" },
  "wallet.refCode": { en: "YOUR REFERRAL CODE", hi: "आपका रेफरल कोड" },
  "wallet.share": { en: "Share", hi: "शेयर" },
  "wallet.badges": { en: "Your Badges", hi: "आपके बैज" },
  "wallet.txns": { en: "Recent Transactions", hi: "हालिया लेनदेन" },
  "wallet.empty": { en: "No transactions yet. Share your code to start earning!", hi: "कोई लेनदेन नहीं। कमाने के लिए कोड शेयर करें!" },
  "wallet.shareMsg": { en: "Join BuildMitra with my referral code", hi: "मेरे रेफरल कोड से BuildMitra जॉइन करें" },
  "badge.bronze": { en: "Bronze", hi: "ब्रॉन्ज़" },
  "badge.silver": { en: "Silver", hi: "सिल्वर" },
  "badge.gold": { en: "Gold", hi: "गोल्ड" },
  "badge.earned": { en: "earned", hi: "कमाए" },

  // Profile
  "profile.mySkills": { en: "My Skills", hi: "मेरे कौशल" },
  "profile.expectedWage": { en: "Expected Daily Wage (₹)", hi: "अपेक्षित दैनिक मजदूरी (₹)" },
  "profile.experience": { en: "Experience (years)", hi: "अनुभव (वर्ष)" },
  "profile.city": { en: "City", hi: "शहर" },
  "profile.cityPh": { en: "e.g. Mumbai", hi: "जैसे मुंबई" },
  "profile.company": { en: "Company Name", hi: "कंपनी का नाम" },
  "profile.save": { en: "Save Profile", hi: "प्रोफ़ाइल सेव करें" },
  "profile.settings": { en: "Settings", hi: "सेटिंग्स" },
  "profile.language": { en: "Language", hi: "भाषा" },
  "profile.aadhaar": { en: "Aadhaar", hi: "आधार" },
  "profile.whatsapp": { en: "WhatsApp Support", hi: "WhatsApp सपोर्ट" },
  "profile.changePassword": { en: "Change Password", hi: "पासवर्ड बदलें" },
  "profile.changePhoto": { en: "Change Photo", hi: "फोटो बदलें" },
  "profile.removePhoto": { en: "Remove Photo", hi: "फोटो हटाएं" },
  "profile.oldPassword": { en: "Old Password", hi: "पुराना पासवर्ड" },
  "profile.newPassword": { en: "New Password", hi: "नया पासवर्ड" },
  "profile.confirmPassword": { en: "Confirm New Password", hi: "नया पासवर्ड दोबारा लिखें" },
  "profile.passwordMismatch": { en: "Passwords do not match", hi: "पासवर्ड मेल नहीं खाते" },
  "profile.passwordShort": { en: "Password must be at least 4 characters", hi: "पासवर्ड कम से कम 4 अक्षर का हो" },
  "profile.passwordUpdated": { en: "Password updated ✓", hi: "पासवर्ड अपडेट हुआ ✓" },
  "profile.updatePassword": { en: "Update Password", hi: "पासवर्ड अपडेट करें" },
  "profile.photoUpdated": { en: "Photo updated ✓", hi: "फोटो अपडेट हुई ✓" },

  // Complaints
  "complaints.title": { en: "Complaints", hi: "शिकायतें" },
  "complaints.heroTitle": { en: "We're here to help", hi: "हम आपकी मदद के लिए हैं" },
  "complaints.heroSub": { en: "File a complaint and our admin team will review it within 48 hours.", hi: "शिकायत दर्ज करें — हमारी टीम 48 घंटे में समीक्षा करेगी।" },
  "complaints.empty": { en: "No complaints filed yet", hi: "अभी तक कोई शिकायत नहीं" },
  "complaints.fileNew": { en: "File Complaint", hi: "शिकायत दर्ज करें" },
  "complaints.category": { en: "Category", hi: "श्रेणी" },
  "complaints.against": { en: "Against", hi: "के विरुद्ध" },
  "complaints.againstOptional": { en: "Against (optional)", hi: "किसके खिलाफ (वैकल्पिक)" },
  "complaints.againstPh": { en: "Name of contractor / worker / client", hi: "ठेकेदार / श्रमिक / क्लाइंट का नाम" },
  "complaints.subject": { en: "Subject", hi: "विषय" },
  "complaints.subjectPh": { en: "Short summary of the issue", hi: "समस्या का संक्षिप्त सारांश" },
  "complaints.description": { en: "Describe the issue", hi: "समस्या का विवरण" },
  "complaints.descPh": { en: "Add details, dates, amounts etc. (min 10 chars)", hi: "विवरण, तिथियाँ, राशि आदि (न्यूनतम 10 अक्षर)" },
  "complaints.submit": { en: "Submit Complaint", hi: "शिकायत भेजें" },
  "complaints.filed": { en: "Complaint filed ✓", hi: "शिकायत दर्ज ✓" },
  "complaints.errSubject": { en: "Subject is required", hi: "विषय आवश्यक है" },
  "complaints.errDesc": { en: "Description must be at least 10 characters", hi: "विवरण कम से कम 10 अक्षर का हो" },
  "complaints.adminNote": { en: "Admin response", hi: "एडमिन का उत्तर" },
  "complaints.tip": { en: "Be specific and factual — false complaints may result in account suspension.", hi: "स्पष्ट और तथ्यात्मक रहें — झूठी शिकायत पर खाता निलंबित हो सकता है।" },
  "complaints.helpSupport": { en: "Help & Support", hi: "सहायता और समर्थन" },
  "complaints.helpSub": { en: "Report issues, payment disputes & more", hi: "समस्याएँ, भुगतान विवाद आदि रिपोर्ट करें" },

  // Help & Support hub
  "help.title": { en: "Help & Support", hi: "सहायता और समर्थन" },
  "help.heroTitle": { en: "How can we help?", hi: "हम कैसे मदद कर सकते हैं?" },
  "help.heroSub": { en: "Chat with us, browse FAQs, or file a complaint. We typically respond within 2 hours.", hi: "हमसे चैट करें, FAQs देखें, या शिकायत दर्ज करें। आमतौर पर 2 घंटे में जवाब।" },
  "help.contactUs": { en: "Contact Us", hi: "संपर्क करें" },
  "help.call": { en: "Call", hi: "कॉल करें" },
  "help.supportHours": { en: "Support: Mon–Sat, 9 AM – 9 PM IST", hi: "सपोर्ट: सोम–शनि, 9 AM – 9 PM IST" },
  "help.quickActions": { en: "Quick Actions", hi: "त्वरित कार्य" },
  "help.fileComplaint": { en: "File a Complaint", hi: "शिकायत दर्ज करें" },
  "help.fileComplaintSub": { en: "Against worker / contractor / payment", hi: "मजदूर / ठेकेदार / भुगतान के विरुद्ध" },
  "help.reportBug": { en: "Report a Bug", hi: "बग रिपोर्ट करें" },
  "help.reportBugSub": { en: "App crash, glitch, or feature not working", hi: "ऐप crash, गड़बड़, या फीचर काम नहीं कर रहा" },
  "help.faqs": { en: "Frequently Asked Questions", hi: "अक्सर पूछे जाने वाले प्रश्न" },
  "help.howToUse": { en: "How to Use BuildMitra", hi: "BuildMitra कैसे चलाएं" },
  "help.about": { en: "About", hi: "ऐप के बारे में" },
  "help.version": { en: "App Version", hi: "ऐप संस्करण" },
  "help.terms": { en: "Terms of Service", hi: "सेवा की शर्तें" },
  "help.privacy": { en: "Privacy Policy", hi: "गोपनीयता नीति" },
  "help.madeWith": { en: "Made with ❤️ in India · © 2026 BuildMitra", hi: "भारत में ❤️ के साथ बनाया गया · © 2026 BuildMitra" },
  "help.cannotOpen": { en: "Cannot open link", hi: "लिंक नहीं खुल सका" },

  // Job detail
  "job.about": { en: "About the work", hi: "काम के बारे में" },
  "job.postedBy": { en: "Posted by", hi: "द्वारा पोस्ट किया गया" },
  "job.apply": { en: "Apply for Job", hi: "जॉब के लिए आवेदन करें" },
  "job.alreadyApplied": { en: "Already Applied", hi: "पहले आवेदन किया" },
  "job.applicants": { en: "Applicants", hi: "आवेदक" },
  "job.notFound": { en: "Job not found", hi: "जॉब नहीं मिला" },
  "job.dailyWage": { en: "Daily Wage", hi: "दैनिक मजदूरी" },
  "job.appliedOk": { en: "Applied ✓", hi: "आवेदन ✓" },

  // Admin
  "admin.console": { en: "ADMIN CONSOLE", hi: "एडमिन कंसोल" },
  "admin.healthSub": { en: "Platform health at a glance", hi: "एक नज़र में प्लेटफ़ॉर्म" },
  "admin.section.people": { en: "People", hi: "लोग" },
  "admin.section.jobs": { en: "Jobs & Activity", hi: "जॉब्स और गतिविधि" },
  "admin.section.ops": { en: "Operations", hi: "संचालन" },
  "admin.kpi.workers": { en: "Workers", hi: "श्रमिक" },
  "admin.kpi.contractors": { en: "Contractors", hi: "ठेकेदार" },
  "admin.kpi.clients": { en: "Clients", hi: "क्लाइंट" },
  "admin.kpi.pending": { en: "Pending Verify", hi: "सत्यापन शेष" },
  "admin.kpi.activeJobs": { en: "Active Jobs", hi: "सक्रिय जॉब्स" },
  "admin.kpi.completed": { en: "Completed", hi: "पूरे हुए" },
  "admin.kpi.applications": { en: "Applications", hi: "आवेदन" },
  "admin.kpi.todayAtt": { en: "Today's Attendance", hi: "आज की उपस्थिति" },
  "admin.kpi.complaints": { en: "Open Complaints", hi: "खुली शिकायतें" },
  "admin.kpi.complaintsSub": { en: "Need attention", hi: "ध्यान चाहिए" },
  "admin.kpi.payouts": { en: "Wallet Payouts", hi: "वॉलेट भुगतान" },
  "admin.kpi.payoutsSub": { en: "Total credited via referrals", hi: "रेफरल से कुल क्रेडिट" },
  "admin.users.title": { en: "User Management", hi: "यूज़र प्रबंधन" },
  "admin.users.search": { en: "Search by name or mobile...", hi: "नाम या मोबाइल से खोजें..." },
  "admin.users.empty": { en: "No users found.", hi: "कोई यूज़र नहीं मिला।" },
  "admin.action.verify": { en: "Verify", hi: "सत्यापित करें" },
  "admin.action.suspend": { en: "Suspend", hi: "निलंबित" },
  "admin.action.unsuspend": { en: "Unsuspend", hi: "बहाल करें" },
  "admin.suspended": { en: "SUSPENDED", hi: "निलंबित" },
  "admin.jobs.title": { en: "Job Monitoring", hi: "जॉब मॉनिटरिंग" },
  "admin.jobs.sub": { en: "All postings across the platform", hi: "प्लेटफ़ॉर्म की सभी पोस्टिंग" },
  "admin.jobs.empty": { en: "No jobs yet.", hi: "अभी कोई जॉब नहीं।" },
  "admin.action.close": { en: "Close Job", hi: "जॉब बंद करें" },
  "admin.complaints.title": { en: "Complaints", hi: "शिकायतें" },
  "admin.complaints.sub": { en: "Review and act on user reports", hi: "यूज़र रिपोर्ट देखें और कार्रवाई करें" },
  "admin.complaints.empty": { en: "No complaints here. ✓", hi: "यहाँ कोई शिकायत नहीं। ✓" },
  "admin.action.resolve": { en: "Resolve", hi: "सुलझाएं" },
  "admin.action.reject": { en: "Reject", hi: "अस्वीकार" },
  "admin.filter.open": { en: "Open", hi: "खुली" },
  "admin.filter.resolved": { en: "Resolved", hi: "सुलझी" },
  "admin.filter.rejected": { en: "Rejected", hi: "अस्वीकृत" },
  "admin.about": { en: "About", hi: "बारे में" },
  "admin.role.label": { en: "Role", hi: "भूमिका" },
  "admin.role.value": { en: "Platform Admin", hi: "प्लेटफ़ॉर्म एडमिन" },
  "admin.hq": { en: "HQ", hi: "मुख्यालय" },
  "admin.powers": { en: "Admin Powers", hi: "एडमिन अधिकार" },
  "admin.power.1": { en: "Verify worker and contractor profiles (Aadhaar gate)", hi: "श्रमिक/ठेकेदार प्रोफ़ाइल सत्यापित करें" },
  "admin.power.2": { en: "Suspend / unsuspend any user account", hi: "किसी भी यूज़र को निलंबित/बहाल करें" },
  "admin.power.3": { en: "Close any job posting", hi: "किसी भी जॉब को बंद करें" },
  "admin.power.4": { en: "Resolve or reject user complaints", hi: "शिकायतें सुलझाएं या अस्वीकार करें" },
  "admin.power.5": { en: "View platform-wide attendance & analytics", hi: "प्लेटफ़ॉर्म-व्यापी उपस्थिति/एनालिटिक्स" },

  // Roles filter
  "filter.workers": { en: "Workers", hi: "श्रमिक" },
  "filter.contractors": { en: "Contractors", hi: "ठेकेदार" },
  "filter.clients": { en: "Clients", hi: "क्लाइंट" },
};

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => Promise<void>;
  t: (key: string) => string;
};

const I18nCtx = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    (async () => {
      const saved = await storage.getItem<Lang>("bm_lang", "en");
      if (saved === "hi" || saved === "en") setLangState(saved);
    })();
  }, []);

  const setLang = useCallback(async (l: Lang) => {
    setLangState(l);
    await storage.setItem("bm_lang", l);
  }, []);

  const t = useCallback((key: string) => {
    const entry = dict[key];
    if (!entry) return key;
    return entry[lang] || entry.en;
  }, [lang]);

  return <I18nCtx.Provider value={{ lang, setLang, t }}>{children}</I18nCtx.Provider>;
}

export function useT() {
  const c = useContext(I18nCtx);
  if (!c) throw new Error("useT outside I18nProvider");
  return c;
}
