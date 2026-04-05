import { NextResponse } from "next/server";

interface GbpInput {
  businessName: string;
  reviewCount: number;
  avgRating: number;
  photoCount: number;
  hasHours: boolean;
  hasDescription: boolean;
  hasCategories: boolean;
  hasWebsite: boolean;
  hasPhone: boolean;
  postsPerMonth: number;
  respondsToReviews: boolean;
  hasServiceArea: boolean;
  hasProducts: boolean;
  hasAppointmentLink: boolean;
  hasMessaging: boolean;
}

interface CheckResult {
  name: string;
  category: "reviews" | "completeness" | "engagement" | "visibility";
  score: number;
  status: "good" | "warning" | "bad";
  detail: string;
  tip: string;
}

export async function POST(req: Request) {
  try {
    const input: GbpInput = await req.json();
    if (!input.businessName) return NextResponse.json({ error: "Business name is required" }, { status: 400 });

    const checks: CheckResult[] = [];

    // ── Reviews ──
    const reviewScore = input.reviewCount >= 50 ? 100 : input.reviewCount >= 20 ? 80 : input.reviewCount >= 10 ? 60 : input.reviewCount >= 5 ? 40 : input.reviewCount > 0 ? 20 : 0;
    checks.push({
      name: "Review Count",
      category: "reviews",
      score: reviewScore,
      status: reviewScore >= 70 ? "good" : reviewScore >= 40 ? "warning" : "bad",
      detail: `${input.reviewCount} reviews. ${input.reviewCount >= 50 ? "Strong social proof." : input.reviewCount >= 20 ? "Good start, keep collecting." : input.reviewCount >= 10 ? "Need more reviews." : "Very few reviews — this hurts trust."}`,
      tip: input.reviewCount < 20 ? "Send a review link after every job. Aim for 50+ reviews." : "Keep the momentum going.",
    });

    const ratingScore = input.avgRating >= 4.7 ? 100 : input.avgRating >= 4.5 ? 90 : input.avgRating >= 4.0 ? 70 : input.avgRating >= 3.5 ? 40 : input.avgRating > 0 ? 20 : 0;
    checks.push({
      name: "Average Rating",
      category: "reviews",
      score: ratingScore,
      status: ratingScore >= 70 ? "good" : ratingScore >= 40 ? "warning" : "bad",
      detail: `${input.avgRating.toFixed(1)} stars. ${ratingScore >= 90 ? "Excellent reputation." : ratingScore >= 70 ? "Solid rating." : "Below average — address negative reviews."}`,
      tip: input.avgRating < 4.5 ? "Respond to every negative review professionally. Ask happy customers to review." : "Maintain your high rating.",
    });

    checks.push({
      name: "Review Responses",
      category: "reviews",
      score: input.respondsToReviews ? 100 : 0,
      status: input.respondsToReviews ? "good" : "bad",
      detail: input.respondsToReviews ? "Business responds to reviews. Shows engagement." : "Not responding to reviews. This signals neglect to potential customers.",
      tip: input.respondsToReviews ? "Keep replying to every review — positive and negative." : "Reply to every review within 24 hours. Google rewards active profiles.",
    });

    // ── Completeness ──
    checks.push({
      name: "Business Hours",
      category: "completeness",
      score: input.hasHours ? 100 : 0,
      status: input.hasHours ? "good" : "bad",
      detail: input.hasHours ? "Business hours are set." : "No hours listed. Customers don't know when you're open.",
      tip: !input.hasHours ? "Add your hours immediately — it's one of the first things people check." : "Keep hours updated, especially holidays.",
    });

    checks.push({
      name: "Business Description",
      category: "completeness",
      score: input.hasDescription ? 100 : 0,
      status: input.hasDescription ? "good" : "bad",
      detail: input.hasDescription ? "Description is filled out." : "Missing business description. You're leaving SEO value on the table.",
      tip: !input.hasDescription ? "Write a 750-character description with your main services and location keywords." : "Good — make sure it includes your top keywords.",
    });

    checks.push({
      name: "Categories",
      category: "completeness",
      score: input.hasCategories ? 100 : 0,
      status: input.hasCategories ? "good" : "bad",
      detail: input.hasCategories ? "Business categories are set." : "No categories set. Google can't classify your business properly.",
      tip: !input.hasCategories ? "Set your primary category and 2-5 secondary categories." : "Review categories quarterly to stay relevant.",
    });

    checks.push({
      name: "Website Link",
      category: "completeness",
      score: input.hasWebsite ? 100 : 0,
      status: input.hasWebsite ? "good" : "bad",
      detail: input.hasWebsite ? "Website link is set." : "No website linked. Missing a major traffic source.",
      tip: !input.hasWebsite ? "Link your website — it drives clicks from Google Maps directly to your site." : "Make sure the link goes to your homepage or a landing page.",
    });

    checks.push({
      name: "Phone Number",
      category: "completeness",
      score: input.hasPhone ? 100 : 0,
      status: input.hasPhone ? "good" : "bad",
      detail: input.hasPhone ? "Phone number is listed." : "No phone number. Most leads want to call.",
      tip: !input.hasPhone ? "Add a trackable phone number immediately." : "Consider a tracking number to measure GBP calls.",
    });

    checks.push({
      name: "Service Area",
      category: "completeness",
      score: input.hasServiceArea ? 100 : 30,
      status: input.hasServiceArea ? "good" : "warning",
      detail: input.hasServiceArea ? "Service area is defined." : "No service area set. Google may not show you for nearby searches.",
      tip: !input.hasServiceArea ? "Define your service area by cities or radius." : "Review and expand as you grow.",
    });

    // ── Engagement ──
    const photoScore = input.photoCount >= 20 ? 100 : input.photoCount >= 10 ? 80 : input.photoCount >= 5 ? 50 : input.photoCount > 0 ? 25 : 0;
    checks.push({
      name: "Photo Count",
      category: "engagement",
      score: photoScore,
      status: photoScore >= 70 ? "good" : photoScore >= 40 ? "warning" : "bad",
      detail: `${input.photoCount} photos. ${photoScore >= 80 ? "Strong visual presence." : photoScore >= 40 ? "Add more photos." : "Very few photos — looks inactive."}`,
      tip: input.photoCount < 20 ? "Upload at least 20 photos: team, work, office, before/afters. Businesses with 100+ photos get 520% more calls." : "Keep adding fresh photos monthly.",
    });

    const postScore = input.postsPerMonth >= 4 ? 100 : input.postsPerMonth >= 2 ? 70 : input.postsPerMonth >= 1 ? 40 : 0;
    checks.push({
      name: "Google Posts",
      category: "engagement",
      score: postScore,
      status: postScore >= 70 ? "good" : postScore >= 40 ? "warning" : "bad",
      detail: `${input.postsPerMonth} posts/month. ${postScore >= 70 ? "Active posting schedule." : postScore >= 40 ? "Post more frequently." : "No posts — profile looks abandoned."}`,
      tip: input.postsPerMonth < 4 ? "Post weekly: promotions, tips, before/afters, team highlights. Google rewards active profiles." : "Great cadence. Mix content types for variety.",
    });

    // ── Visibility ──
    checks.push({
      name: "Products/Services Listed",
      category: "visibility",
      score: input.hasProducts ? 100 : 20,
      status: input.hasProducts ? "good" : "warning",
      detail: input.hasProducts ? "Products or services are listed." : "No products/services listed. Missing keyword opportunities.",
      tip: !input.hasProducts ? "List every service you offer with descriptions. These show up in search and create keyword signals." : "Keep service list current and detailed.",
    });

    checks.push({
      name: "Appointment/Booking Link",
      category: "visibility",
      score: input.hasAppointmentLink ? 100 : 20,
      status: input.hasAppointmentLink ? "good" : "warning",
      detail: input.hasAppointmentLink ? "Booking link is active." : "No booking link. You're adding friction to the conversion.",
      tip: !input.hasAppointmentLink ? "Add a direct booking link so customers can schedule from your GBP listing." : "Make sure the link works and is easy to use.",
    });

    checks.push({
      name: "Messaging Enabled",
      category: "visibility",
      score: input.hasMessaging ? 100 : 30,
      status: input.hasMessaging ? "good" : "warning",
      detail: input.hasMessaging ? "Google messaging is enabled." : "Messaging is off. Some customers prefer texting over calling.",
      tip: !input.hasMessaging ? "Enable messaging in your GBP settings. Set up auto-replies for after hours." : "Respond to messages within 24 hours to keep the feature active.",
    });

    // ── Calculate overall ──
    const totalScore = Math.round(checks.reduce((s, c) => s + c.score, 0) / checks.length);
    const grade = totalScore >= 90 ? "A+" : totalScore >= 80 ? "A" : totalScore >= 70 ? "B" : totalScore >= 60 ? "C" : totalScore >= 50 ? "D" : "F";
    const goodCount = checks.filter(c => c.status === "good").length;
    const warningCount = checks.filter(c => c.status === "warning").length;
    const badCount = checks.filter(c => c.status === "bad").length;

    return NextResponse.json({
      businessName: input.businessName,
      score: totalScore,
      grade,
      checks,
      summary: { good: goodCount, warning: warningCount, bad: badCount, total: checks.length },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
