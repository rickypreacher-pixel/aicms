# NTCC Church Database — Staff Guide

**New Testament Christian Church of Glendale**
Last updated: May 8, 2026

This guide is written for church office staff, administrators, and pastors. No technical knowledge required.

---

## Table of Contents

1. [Logging In](#logging-in)
2. [Dashboard Overview](#dashboard-overview)
3. [Members](#members)
   - [Browsing the Member List](#browsing-the-member-list)
   - [Member Profile](#member-profile)
   - [Add Person (New Member)](#add-person-new-member)
4. [Prospects / Visitors](#prospects--visitors)
   - [Adding a Prospect](#adding-a-prospect)
   - [Visitation Pipeline](#visitation-pipeline)
   - [Thank You Letters](#thank-you-letters)
5. [Attendance](#attendance)
6. [Giving](#giving)
7. [Prayer Requests](#prayer-requests)
8. [Events](#events)
9. [Service Roles](#service-roles)
10. [Check-In Portal](#check-in-portal)
11. [Pastor Report](#pastor-report)
12. [Access Control (Admin Only)](#access-control-admin-only)
13. [Recent Updates — May 2026](#recent-updates--may-2026)

---

## Logging In

1. Go to **https://aicms-pied.vercel.app** (or your church's assigned URL).
2. Enter your email and password.
3. If it's your first time, contact the church administrator to set up your account.

> **Forgot your password?** Use the "Forgot Password" link on the login screen.

---

## Dashboard Overview

After logging in you'll see the main dashboard with quick-access cards for:

- **Members** — full church directory
- **Prospects** — visitor and follow-up pipeline
- **Attendance** — service attendance records
- **Giving** — tithe and offering records
- **Prayer** — prayer request board
- **Events** — upcoming church events
- **AI Chat** — talk to the church AI assistant in plain English

Use the **sidebar** (left side) to navigate between sections.

---

## Members

### Browsing the Member List

- Use the **search bar** at the top to find members by name.
- Filter by **status** (Active, Inactive, Visitor) or **campus** using the dropdowns.
- Click any member's row to open their full profile.

### Member Profile

Each profile shows:

| Section | What's included |
|---|---|
| **Personal Info** | Name, gender, birthday, phone, email, address |
| **Family** | Spouse, children, emergency contact |
| **Faith** | Salvation date, baptism date, role in church |
| **Medical** | Allergies, medical notes (confidential) |
| **Attendance** | Recent service attendance |
| **Giving** | Contribution history |
| **Notes** | Free-form staff notes |

### Add Person (New Member)

To add a new member, click **+ Add Person** from the Members page.

#### Required fields

| Field | Notes |
|---|---|
| **First Name** | Required |
| **Last Name** | Required |
| **Gender** | Required — choose Male or Female using the radio buttons |

#### Phone numbers

All phone fields automatically format as **(###) ###-####** as you type. Just type the digits — the dashes and parentheses appear on their own.

This applies to:
- Member's main phone
- Emergency contact phone

#### Family section

When you fill in a **Spouse** name or add **Children**, the system automatically creates full member profiles for them when you save.

**Spouse profile includes:**
- Spouse Phone
- Spouse Email
- Spouse Birthday
- Spouse Gender (radio buttons)
- Address (copied from the primary member)

**Children profiles include:**
- Birthday
- Gender
- Grade

> This means you only have to fill in one form — the whole family gets individual records at once. You won't need to go back and add them separately.

#### Saving

Click **Save** when done. If any required field is missing, you'll see a reminder before anything is saved.

---

## Prospects / Visitors

### Adding a Prospect

Click **+ Add Prospect** from the Prospects page.

#### Required fields

| Field | Notes |
|---|---|
| **First Name** | Required |
| **Phone** | Required |
| **Last Name** | Optional |

> Last name is optional — this makes it easy to add walk-in visitors who only gave a first name and number.

The phone field auto-formats to **(###) ###-####** as you type.

#### Optional fields

- Email
- Address (street, city, state, zip)
- Notes / how they heard about the church
- Referred by

### Visitation Pipeline

The Prospects page has a **Kanban-style pipeline** with columns for each stage:

1. **First Visit** — just walked in
2. **Contacted** — staff has reached out
3. **Visited** — team visited them at home
4. **Follow-up** — ongoing follow-up in progress
5. **Connected** — attending regularly
6. **Converted** — became a member

Drag a prospect's card from one column to the next as they progress.

**Assigning a team member:**
- Open the prospect card.
- Use the **Team Leader** and **Sponsor** fields to assign staff.
- The assigned person receives an automatic SMS and email notification.

### Thank You Letters

After a home visit, you can generate a personalized **Thank You Letter** for the prospect.

1. Open the prospect's card.
2. Click **Thank You Letter**.

> **Important:** The Thank You Letter button is grayed out if the prospect does not have a full address (street, city, state, and zip are all required). Make sure the address is filled in before the visit.

The letter is generated by the AI and addressed directly to the prospect. You can copy it and send via email, print it, or mail it.

---

## Attendance

- Select a **service** from the dropdown (Sunday AM, Sunday PM, Thursday PM, etc.).
- Use the **date picker** to choose the service date.
- Check off members who were present, or use the **Check-In Portal** for self check-in.
- Click **Save Attendance** when done.

Attendance history is visible on each member's profile.

---

## Giving

- Records are linked to each member automatically when entered.
- You can filter by **date range**, **fund** (Tithe, Offering, Missions, etc.), and **campus**.
- Click any record to edit or add a note.
- Use the **Export** button to download a CSV for your records.

---

## Prayer Requests

- Any member or prospect can have a prayer request logged.
- Requests appear on the **Prayer Board** (visible to authorized staff).
- Mark a request as **Answered** when the prayer has been resolved.
- Add private notes that only staff can see.

---

## Events

- View all upcoming events on the **Events** page.
- Click **+ New Event** to create one.
- Events can be set as **recurring** (weekly, monthly).
- Attach events to specific campuses if your church has multiple locations.

---

## Service Roles

Manage who is serving in each ministry position:

- **Team Leader** — oversees a ministry team
- **Sponsor** — mentors new members or prospects
- **Teacher** — Sunday School or Bible Study
- **Musician** — worship team
- **Kitchen Team** — hospitality

Assign members to roles from the **Service Roles** page.

---

## Check-In Portal

The Check-In Portal is a tablet-friendly kiosk screen for self-service check-in at the door.

- Staff selects the **current service** and **date** to open the kiosk.
- Members can search their name and tap to check in.
- New families can use the **Quick Intake** form to register on the spot.
- Attendance is recorded automatically.

---

## Pastor Report

> **Pastor and Admin only**

The Pastor Report provides a private health summary of the church:

- Attendance trends over time
- Giving trends
- Visitor and follow-up activity
- Membership growth
- Prayer request activity
- Volunteer/service role coverage

Reports can be filtered by date range. All data is restricted to authorized accounts.

---

## Access Control (Admin Only)

> **Admin only** — only the system administrator sees this section.

The **Access Control** page manages who can log in and what they can see:

- **Add User** — search for a member and assign them a login account.
- **Roles:**
  - **Admin** — full access to everything
  - **Pastor** — full access including Pastor Report
  - **Staff** — standard office access (no Admin or Pastor Report)
  - **Volunteer** — limited view (attendance, events)

- **Deactivate** a user to revoke their access without deleting their record.
- The **Audit Log** tracks every login and data change for accountability.

---

## Recent Updates — May 2026

The following features were added or improved in May 2026.

---

### 1. Gender Field — Add Person

- Gender is now a **required field** when adding a new member.
- Choose **Male** or **Female** using the radio buttons.
- The form will not save until a gender is selected.

---

### 2. Phone Number Auto-Formatting

All phone number fields now automatically format as **(###) ###-####** as you type.

**Fields affected:**
- Add Person → Main Phone
- Add Person → Emergency Contact Phone
- Prospects → Phone

You just type the 10 digits — the formatting happens live. No need to type dashes or parentheses yourself.

---

### 3. Visitation — Thank You Letter Improvements

**Address required:**
The **Thank You Letter** button is now grayed out if the prospect's address is incomplete. All four address fields (street, city, state, zip) must be filled in before the letter can be generated. This prevents sending a letter without a mailing address.

**Cleaner letter output:**
The AI no longer adds introductory filler text ("Certainly! Here is your letter…") at the start. The letter now begins directly with "Dear [Name]" for a clean, professional result.

---

### 4. Prospects — Simplified Required Fields

Adding a new prospect now only requires:
- **First Name**
- **Phone**

**Last name is optional.** This is a practical change for walk-in visitors who may only share their first name and phone number at the door. The prospect can still be tracked and followed up on without a full name.

---

### 5. Family Profiles — Auto-Created on Save (Add Person)

When you add a new member and include their **spouse** and/or **children**, the system now automatically creates **full member records** for each family member when you save.

**Before this update:** You had to go back and manually add the spouse and children as separate members.

**After this update:** Fill in the family information once — everyone gets their own profile automatically.

**What gets saved for the spouse:**
- First and last name
- Phone number
- Email address
- Birthday
- Gender
- Address (copied from the primary member)
- Linked to the same family record

**What gets saved for each child:**
- First and last name
- Birthday
- Gender
- Grade level
- Linked to the same family record

All family members appear in the full member directory once saved.

---

*For technical support or to request a new feature, contact your system administrator.*
