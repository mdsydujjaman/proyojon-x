const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const Shop = require("./models/Shop");
const User = require("./models/User");
const Payment = require("./models/Payment");
const Request = require("./models/Request");
const Match = require("./models/Match");
const DealChat = require("./models/DealChat");
const Product = require("./models/Product");
const Post = require("./models/Post");
const Service = require("./models/Service");
const { createRenewalPayment, completeRenewalPayment } = require("./services/paymentService");
const { createConfirmationPayments, completeConfirmationPayment } = require("./services/confirmationService");
const {
    createProductPayment,
    completeProductPayment
} = require("./services/productPaymentService");
const {
    createServicePayment,
    completeServicePayment
} = require("./services/servicePaymentService");
const categories = require("./config/categories");
const {
    validatePublicContent
} = require("./utils/contentSafety");


require("dotenv").config();

const app = express();


// ==================================================
// MIDDLEWARE
// ==================================================

app.use(
    helmet()
);

app.use(express.json());

app.use(
    express.urlencoded({
        extended: true
    })
);

const SESSION_SECRET = process.env.SESSION_SECRET;

if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
    console.error(
        "❌ SESSION_SECRET is missing or too short. Set a strong SESSION_SECRET in .env."
    );
    process.exit(1);
}

const isProduction = process.env.NODE_ENV === "production";

app.use(
    session({
        secret: SESSION_SECRET,

        resave: false,

        saveUninitialized: false,

        cookie: {
            maxAge: 1000 * 60 * 60 * 24 * 7,

            httpOnly: true,

            sameSite: "lax",

            secure: isProduction
        }
    })
);


// ==================================================
// RATE LIMITING
// ==================================================

const authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false
});

const passwordResetRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false
});


// Static files
app.use(express.static(__dirname));


// ==================================================
// GLOBAL ERROR HANDLING
// ==================================================

process.on("uncaughtException", (error) => {
    console.error("❌ Uncaught Exception:", error.message);
    process.exit(1);
});

process.on("unhandledRejection", (reason) => {
    console.error(
        "❌ Unhandled Promise Rejection:",
        reason instanceof Error ? reason.message : reason
    );
    process.exit(1);
});


// ==================================================
// MONGODB
// ==================================================

mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => {

        console.log(
            "✅ MongoDB Connected Successfully"
        );

        app.listen(
            PORT,
            () => {

                console.log(
                    `🚀 Server running on port ${PORT}`
                );

            }
        );

    })
    .catch((error) => {

        console.error(
            "❌ MongoDB Connection Error:",
            error.message
        );

        process.exit(1);

    });


// ==================================================
// CATEGORY ARCHITECTURE
// ==================================================

app.get("/api/categories", (req, res) => {
    res.json({
        success: true,
        version: "Final Master Blueprint A-to-Z",
        categories
    });
});

// ==================================================
// HOME
// ==================================================

app.get("/", (req, res) => {

    res.sendFile(
        __dirname + "/index.html"
    );

});


// ==================================================
// ADMIN AUTHORIZATION MIDDLEWARE
// ==================================================

async function requireAdmin(req, res, next) {

    try {

        // Login করা আছে কিনা
        if (!req.session.userId) {

            return res.status(401).json({

                success: false,

                message:
                    "Admin login required."

            });

        }


        const admin =
            await User.findById(
                req.session.userId
            );


        if (!admin) {

            return res.status(401).json({

                success: false,

                message:
                    "User পাওয়া যায়নি।"

            });

        }


        // Account blocked কিনা
        if (
            admin.accountStatus ===
            "blocked"
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "আপনার account blocked।"

            });

        }


        // Admin role check
        if (
            admin.role !==
            "admin"
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "❌ আপনার Admin permission নেই।"

            });

        }


        // Admin পাওয়া গেছে
        req.admin = admin;

        next();


    } catch (error) {

        console.log(
            "❌ Admin Authentication Error:",
            error.message
        );

        return res.status(500).json({

            success: false,

            message:
                "Admin authentication failed."

        });

    }

}


// ==================================================
// USER REGISTRATION
// ==================================================

app.post(
    "/api/register",
    async (req, res) => {

        try {

            const {
                name,
                phone,
                email,
                password
            } = req.body;


            if (
                !name ||
                !phone ||
                !password
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "নাম, মোবাইল নম্বর ও Password দিন।"

                });

            }


            const existingUser =
                await User.findOne({
                    phone: phone
                });


            if (existingUser) {

                return res.status(400).json({

                    success: false,

                    message:
                        "এই মোবাইল নম্বর দিয়ে ইতিমধ্যে Registration করা হয়েছে।"

                });

            }


            const hashedPassword =
                await bcrypt.hash(
                    password,
                    10
                );


            const user =
                new User({

                    name: name,

                    phone: phone,

                    email:
                        email || "",

                    latitude:
                        Number(req.body.latitude),

                    longitude:
                        Number(req.body.longitude),

                    password:
                        hashedPassword,

                    role:
                        "client",

                    accountStatus:
                        "active",

                    registrationStatus:
                        "free",

                    registrationStartDate:
                        new Date(),

                    registrationExpiryDate:
                        null,

                    isApproved:
                        false

                });


            const savedUser =
                await user.save();


            req.session.userId =
                savedUser._id.toString();


            res.status(201).json({

                success: true,

                message:
                    "🎉 Registration সফল হয়েছে। প্রথম Registration সম্পূর্ণ ফ্রি।",

                user: {

                    id:
                        savedUser._id,

                    name:
                        savedUser.name,

                    phone:
                        savedUser.phone,

                    role:
                        savedUser.role

                }

            });


        } catch (error) {

            console.log(
                "❌ Registration Error:",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "Registration করা যায়নি।",

                error:
                    error.message

            });

        }

    }
);


// ==================================================
// LOGIN
// ==================================================

app.post(
    "/api/login",
    authRateLimit,
    async (req, res) => {

        try {

            const {
                phone,
                password
            } = req.body;


            if (
                !phone ||
                !password
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "মোবাইল নম্বর ও Password দিন।"

                });

            }


            const user =
                await User.findOne({
                    phone: phone
                });


            if (!user) {

                return res.status(401).json({

                    success: false,

                    message:
                        "মোবাইল নম্বর অথবা Password ভুল।"

                });

            }


            if (
                user.accountStatus ===
                "blocked"
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "আপনার account বর্তমানে blocked।"

                });

            }


            let passwordMatch =
                false;

            let oldPassword =
                false;


            const isBcryptPassword =
                typeof user.password ===
                    "string" &&
                (
                    user.password.startsWith(
                        "$2a$"
                    ) ||
                    user.password.startsWith(
                        "$2b$"
                    ) ||
                    user.password.startsWith(
                        "$2y$"
                    )
                );


            if (isBcryptPassword) {

                passwordMatch =
                    await bcrypt.compare(
                        password,
                        user.password
                    );

            } else {

                // পুরোনো plain password থাকলে
                if (
                    user.password ===
                    password
                ) {

                    passwordMatch =
                        true;

                    oldPassword =
                        true;

                }

            }


            if (!passwordMatch) {

                return res.status(401).json({

                    success: false,

                    message:
                        "মোবাইল নম্বর অথবা Password ভুল।"

                });

            }


            // পুরোনো password থাকলে
            // Login-এর সময় bcrypt করা

            if (oldPassword) {

                user.password =
                    await bcrypt.hash(
                        password,
                        10
                    );

                await user.save();

                console.log(
                    "🔐 Old password automatically secured."
                );

            }


            req.session.userId =
                user._id.toString();


            res.json({

                success: true,

                message:
                    "✅ Login সফল হয়েছে।",

                user: {

                    id:
                        user._id,

                    name:
                        user.name,

                    phone:
                        user.phone,

                    role:
                        user.role,

                    registrationStatus:
                        user.registrationStatus

                }

            });


        } catch (error) {

            console.log(
                "❌ Login Error:",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "Login করা যায়নি।",

                error:
                    error.message

            });

        }

    }
);



// ==================================================
// PAYMENT - MONTHLY RENEWAL
// ==================================================

app.post("/api/payment/renewal/create", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Login required."
            });
        }

        const payment = await createRenewalPayment(
            req.session.userId
        );

        res.status(201).json({
            success: true,
            message: "মাসিক নবায়নের জন্য ১ টাকার Payment তৈরি হয়েছে।",
            payment: {
                id: payment._id,
                amount: payment.amount,
                status: payment.status,
                paymentType: payment.paymentType
            }
        });

    } catch (error) {
        console.log("❌ Renewal Payment Error:", error.message);

        res.status(500).json({
            success: false,
            message: "Renewal Payment তৈরি করা যায়নি।"
        });
    }
});


app.post("/api/payment/renewal/complete", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Login required."
            });
        }

        const { paymentId, transactionId } = req.body;

        if (!paymentId) {
            return res.status(400).json({
                success: false,
                message: "Payment ID দিন।"
            });
        }

        const payment = await Payment.findById(paymentId);

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: "Payment পাওয়া যায়নি।"
            });
        }

        if (
            payment.payer.toString() !==
            req.session.userId
        ) {
            return res.status(403).json({
                success: false,
                message: "এই Payment আপনার নয়।"
            });
        }

        const result = await completeRenewalPayment(
            paymentId,
            req.session.userId,
            transactionId || null
        );

        res.json({
            success: true,
            message: "✅ Renewal Payment সফল হয়েছে।",
            payment: {
                id: result.payment._id,
                amount: result.payment.amount,
                status: result.payment.status,
                paidAt: result.payment.paidAt
            },
            registration: {
                status: result.user.registrationStatus,
                expiryDate: result.user.registrationExpiryDate
            }
        });

    } catch (error) {
        console.log("❌ Complete Renewal Error:", error.message);

        res.status(500).json({
            success: false,
            message: "Renewal সম্পন্ন করা যায়নি।"
        });
    }
});



// ==================================================
// STEP 5G - LOCAL NEWS POSTS
// ==================================================

app.post("/api/posts", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Login required."
            });
        }

        const {
            title,
            content,
            district,
            upazila,
            union,
            village,
            latitude,
            longitude,
            image
        } = req.body;

        if (!title || !String(title).trim()) {
            return res.status(400).json({
                success: false,
                message: "পোস্টের শিরোনাম দিন।"
            });
        }

        if (!content || !String(content).trim()) {
            return res.status(400).json({
                success: false,
                message: "পোস্টের বিষয়বস্তু দিন।"
            });
        }

        const safety = validatePublicContent(
            String(title) + " " + String(content)
        );

        if (!safety.valid) {
            return res.status(400).json({
                success: false,
                message: safety.message
            });
        }

        const post = await Post.create({
            author: req.session.userId,

            type: "local_news",

            title: String(title).trim(),

            content: String(content).trim(),

            district: district
                ? String(district).trim()
                : "",

            upazila: upazila
                ? String(upazila).trim()
                : "",

            union: union
                ? String(union).trim()
                : "",

            village: village
                ? String(village).trim()
                : "",

            latitude:
                latitude === null ||
                latitude === undefined ||
                latitude === ""
                    ? null
                    : Number(latitude),

            longitude:
                longitude === null ||
                longitude === undefined ||
                longitude === ""
                    ? null
                    : Number(longitude),

            image: image
                ? String(image).trim()
                : "",

            status: "published"
        });

        return res.status(201).json({
            success: true,
            message: "✅ Local News Post সফলভাবে প্রকাশ হয়েছে।",
            post
        });

    } catch (error) {
        console.log(
            "❌ Local News Post Create Error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Post তৈরি করা যায়নি।"
        });
    }
});


// ==================================================
// STEP 5G-6 - PUBLISHED LOCAL NEWS FEED
// ==================================================

app.get("/api/posts", async (req, res) => {
    try {
        const {
            district,
            upazila,
            union,
            village
        } = req.query;

        const filter = {
            type: "local_news",
            status: "published"
        };

        if (district) {
            filter.district = String(district).trim();
        }

        if (upazila) {
            filter.upazila = String(upazila).trim();
        }

        if (union) {
            filter.union = String(union).trim();
        }

        if (village) {
            filter.village = String(village).trim();
        }

        const posts = await Post.find(filter)
        .populate(
            "author",
            "name"
        )
        .sort({
            createdAt: -1
        })
        .limit(50)
        .lean();

        return res.json({
            success: true,
            posts
        });

    } catch (error) {
        console.log(
            "❌ Local News Feed Error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Local News Feed পাওয়া যায়নি।"
        });
    }
});


// ==================================================
// V1 - REQUESTS
// ==================================================

app.post("/api/requests", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Login required."
            });
        }

        const {
            type,
            title,
            description,
            category,
            subcategory,
            district,
            upazila,
            union,
            village,
            budget,
            latitude,
            longitude
        } = req.body;

        if (!type || !title) {
            return res.status(400).json({
                success: false,
                message: "Type ও Title দিন।"
            });
        }

        const request = await Request.create({
            requester: req.session.userId,
            type,
            title,
            description: description || "",
            category: category || "",
            subcategory: subcategory || "",
            district: district || "",
            upazila: upazila || "",
            union: union || "",
            village: village || "",
            budget: Number(budget) || 0,
                        latitude:
                latitude === null ||
                latitude === undefined ||
                latitude === ""
                    ? null
                    : Number(latitude),

            longitude:
                longitude === null ||
                longitude === undefined ||
                longitude === ""
                    ? null
                    : Number(longitude),

            ...(Number.isFinite(Number(latitude)) &&
               Number.isFinite(Number(longitude))
                ? {
                    location: {
                        type: "Point",
                        coordinates: [
                            Number(longitude),
                            Number(latitude)
                        ]
                    }
                }
                : {})
        });

        res.status(201).json({
            success: true,
            message: "✅ Request সফলভাবে তৈরি হয়েছে।",
            request
        });

    } catch (error) {
        console.log("❌ Request Create Error:", error.message);

        res.status(500).json({
            success: false,
            message: "Request তৈরি করা যায়নি।"
        });
    }
});


app.get("/api/requests/my", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Login required."
            });
        }

        const requests = await Request.find({
            requester: req.session.userId
        }).sort({
            createdAt: -1
        });

        res.json({
            success: true,
            requests
        });

    } catch (error) {
        console.log("❌ My Requests Error:", error.message);

        res.status(500).json({
            success: false,
            message: "Request পাওয়া যায়নি।"
        });
    }
});


// ==================================================
// STEP 5G-39 — SAFE NEARBY REQUEST QUERY
// ==================================================

app.get("/api/requests/nearby", async (req, res) => {
    try {
        const latitude = Number(req.query.latitude);
        const longitude = Number(req.query.longitude);
        const radiusKm = Number(req.query.radiusKm || 10);

        const page = Math.max(
            Number.parseInt(req.query.page || "1", 10),
            1
        );

        const pageSize = Math.min(
            Math.max(
                Number.parseInt(req.query.pageSize || "20", 10),
                1
            ),
            50
        );
        // STEP 5G-44I-CURSOR-V3
        const cursor = req.query.cursor
            ? String(req.query.cursor)
            : null;

        let cursorDistanceMeters = null;
        let cursorId = null;

        if (cursor) {
            try {
                const decoded = JSON.parse(
                    Buffer.from(cursor, "base64url").toString("utf8")
                );

                cursorDistanceMeters = Number(decoded.distanceMeters);
                cursorId = String(decoded.id);

                if (
                    !Number.isFinite(cursorDistanceMeters) ||
                    !/^[a-fA-F0-9]{24}$/.test(cursorId)
                ) {
                    throw new Error("invalid cursor");
                }
            } catch {
                return res.status(400).json({
                    success: false,
                    message: "অবৈধ cursor।"
                });
            }
        }


        if (!Number.isFinite(latitude) ||
            !Number.isFinite(longitude)) {
            return res.status(400).json({
                success: false,
                message: "সঠিক latitude ও longitude দিন।"
            });
        }

        if (
            latitude < -90 ||
            latitude > 90 ||
            longitude < -180 ||
            longitude > 180
        ) {
            return res.status(400).json({
                success: false,
                message: "অবৈধ latitude/longitude।"
            });
        }

        if (
            !Number.isFinite(radiusKm) ||
            radiusKm <= 0 ||
            radiusKm > 100
        ) {
            return res.status(400).json({
                success: false,
                message: "radiusKm 0 থেকে 100-এর মধ্যে হতে হবে।"
            });
        }

        const skip = cursor ? 0 : (page - 1) * pageSize;

        const results = await Request.aggregate([
            {
                $geoNear: {
                    near: {
                        type: "Point",
                        coordinates: [longitude, latitude]
                    },
                    key: "location",
                    distanceField: "distanceMeters",
                    maxDistance: radiusKm * 1000,
                    spherical: true,
                    query: {
                        status: "open"
                    }
                }
            },
            ...(cursor ? [{
                $match: {
                    $or: [
                        {
                            distanceMeters: {
                                $gt: cursorDistanceMeters
                            }
                        },
                        {
                            distanceMeters: cursorDistanceMeters,
                            _id: {
                                $gt: new mongoose.Types.ObjectId(cursorId)
                            }
                        }
                    ]
                }
            }] : []),
            {
                $skip: skip
            },
            {
                $limit: pageSize + 1
            },
            {
                $set: {
                    distanceKm: {
                        $round: [
                            {
                                $divide: [
                                    "$distanceMeters",
                                    1000
                                ]
                            },
                            3
                        ]
                    }
                }
            },
        ]);

        const hasMore = results.length > pageSize;

        const lastItem = hasMore
            ? results[pageSize - 1]
            : results[results.length - 1];

        const nextCursor = lastItem
            ? Buffer.from(JSON.stringify({
                distanceMeters: lastItem.distanceMeters,
                id: String(lastItem._id)
            })).toString("base64url")
            : null;

        const requests = results
            .slice(0, pageSize)
            .map(({ distanceMeters, ...request }) => request);

        return res.json({
            success: true,
            count: requests.length,
            totalNearby: null,
            page,
            pageSize,
            hasMore,
            nextCursor,
            radiusKm,
            requests
        });

    } catch (error) {
        console.error(
            "Nearby Request Geo Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Nearby request search ব্যর্থ হয়েছে।"
        });
    }
});

app.get("/api/requests/open", async (req, res) => {
    try {
        const page = Math.max(Number.parseInt(req.query.page || "1", 10), 1);
        const pageSize = Math.min(
            Math.max(Number.parseInt(req.query.pageSize || "50", 10), 1),
            100
        );

        const cursor = req.query.cursor
            ? String(req.query.cursor)
            : null;

        let cursorDate = null;
        let cursorId = null;

        if (cursor) {
            try {
                const decoded = JSON.parse(
                    Buffer.from(cursor, "base64url").toString("utf8")
                );

                cursorDate = new Date(decoded.createdAt);
                cursorId = String(decoded.id);

                if (
                    !Number.isFinite(cursorDate.getTime()) ||
                    !/^[a-fA-F0-9]{24}$/.test(cursorId)
                ) {
                    throw new Error("invalid cursor");
                }
            } catch {
                return res.status(400).json({
                    success: false,
                    message: "অবৈধ cursor।"
                });
            }
        }

        const requestFilter = cursor
            ? {
                status: "open",
                $or: [
                    { createdAt: { $lt: cursorDate } },
                    {
                        createdAt: cursorDate,
                        _id: {
                            $lt: new mongoose.Types.ObjectId(cursorId)
                        }
                    }
                ]
            }
            : {
                status: "open"
            };

        const requests = await Request.find(requestFilter)
            .populate(
                "requester",
                "name phone"
            )
            .sort({
                createdAt: -1,
                _id: -1
            })
            .limit(pageSize + 1)
            .lean();

        const hasMore = requests.length > pageSize;
        const items = requests.slice(0, pageSize);
        const lastItem = items[items.length - 1];

        const nextCursor = hasMore && lastItem
            ? Buffer.from(
                JSON.stringify({
                    createdAt: lastItem.createdAt,
                    id: String(lastItem._id)
                })
            ).toString("base64url")
            : null;

        res.json({
            success: true,
            requests: items,
            hasMore,
            nextCursor
        });

    } catch (error) {
        console.log("❌ Open Requests Error:", error.message);

        res.status(500).json({
            success: false,
            message: "Open Request পাওয়া যায়নি।"
        });
    }
});


// ==================================================
// V1 - CREATE MATCH
// ==================================================

app.post("/api/matches", async (req, res) => {
    console.log("🔎 MATCH API BODY:", req.body, "USER:", req.session.userId);
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Login required."
            });
        }

        const {
            requestId,
            listingType,
            listingId
        } = req.body;

        if (
            !requestId ||
            !listingType ||
            !listingId
        ) {
            return res.status(400).json({
                success: false,
                message: "Request ID, Listing Type ও Listing ID দিন।"
            });
        }

        const request =
            await Request.findById(requestId);

        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Request পাওয়া যায়নি।"
            });
        }

        if (request.status !== "open") {
            return res.status(400).json({
                success: false,
                message: "এই Request আর Open নেই।"
            });
        }

        if (
            request.requester.toString() ===
            req.session.userId
        ) {
            return res.status(400).json({
                success: false,
                message: "নিজের Request-এ নিজে Provider হতে পারবেন না।"
            });
        }

        let listing = null;

        if (listingType === "product") {
            listing =
                await Product.findById(listingId);
        } else if (listingType === "service") {
            listing =
                await Service.findById(listingId);
        }

        if (!listing) {
            return res.status(404).json({
                success: false,
                message: "Listing পাওয়া যায়নি।"
            });
        }

        if (
            listing.owner.toString() !==
            req.session.userId
        ) {
            return res.status(403).json({
                success: false,
                message: "এই Listing আপনার নয়।"
            });
        }

        const existing =
            await Match.findOne({
                request: requestId,
                provider: req.session.userId,
                status: {
                    $in: [
                        "pending",
                        "accepted",
                        "confirmed"
                    ]
                }
            });

        if (existing) {
            return res.status(400).json({
                success: false,
                message: "এই Request-এর জন্য আপনার Match ইতিমধ্যে আছে।"
            });
        }

        const match = await Match.create({
            request: requestId,
            requester: request.requester,
            provider: req.session.userId,
            listingType,
            listingId,
            status: "pending"
        });

        request.status = "matched";
        await request.save();

        res.status(201).json({
            success: true,
            message: "✅ Match তৈরি হয়েছে।",
            match
        });

    } catch (error) {
        console.log("❌ Match Create Error:", error.message);

        // Handle MongoDB duplicate-key race condition gracefully.
        if (error && error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: "এই Request-এর জন্য আপনার Match ইতিমধ্যে আছে।"
            });
        }

        res.status(500).json({
            success: false,
            message: "Match তৈরি করা যায়নি।"
        });
    }
});


// ==================================================
// V1 - MY MATCHES
// ==================================================

app.get("/api/matches/my", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Login required."
            });
        }

        const userId = req.session.userId;

        const matches = await Match.find({
            $or: [
                { requester: userId },
                { provider: userId }
            ]
        })
        .populate("requester", "name")
        .populate("provider", "name")
        .populate(
            "requesterPayment",
            "amount status transactionId paidAt paymentType"
        )
        .populate(
            "providerPayment",
            "amount status transactionId paidAt paymentType"
        )
        .sort({
            createdAt: -1
        });

        const safeMatches = matches.map(match => {
            const item = match.toObject();

            const isRequester =
                match.requester &&
                match.requester._id.toString() === userId.toString();

            const isProvider =
                match.provider &&
                match.provider._id.toString() === userId.toString();

            // Contact is available only after both payments are paid.
            const requesterPaid =
                match.requesterPayment &&
                match.requesterPayment.status === "paid";

            const providerPaid =
                match.providerPayment &&
                match.providerPayment.status === "paid";

            const bothPaid =
                requesterPaid && providerPaid;

            const confirmed =
                match.status === "confirmed" &&
                bothPaid;

            // Never expose contact information before confirmation.
            delete item.requesterAddress;
            delete item.requesterMobileNumber1;
            delete item.requesterMobileNumber2;
            delete item.providerAddress;
            delete item.providerMobileNumber1;
            delete item.providerMobileNumber2;

            if (confirmed) {

                // Show only the OTHER person's contact.
                if (isRequester) {
                    item.otherPartyContact = {
                        role: "provider",
                        address: match.providerAddress || "",
                        mobileNumber1: match.providerMobileNumber1 || "",
                        mobileNumber2: match.providerMobileNumber2 || ""
                    };
                }

                else if (isProvider) {
                    item.otherPartyContact = {
                        role: "requester",
                        address: match.requesterAddress || "",
                        mobileNumber1: match.requesterMobileNumber1 || "",
                        mobileNumber2: match.requesterMobileNumber2 || ""
                    };
                }

                // Indicate whether current user has already saved contact.
                if (isRequester) {
                    item.myContact = {
                        address: match.requesterAddress || "",
                        mobileNumber1: match.requesterMobileNumber1 || "",
                        mobileNumber2: match.requesterMobileNumber2 || ""
                    };
                }

                else if (isProvider) {
                    item.myContact = {
                        address: match.providerAddress || "",
                        mobileNumber1: match.providerMobileNumber1 || "",
                        mobileNumber2: match.providerMobileNumber2 || ""
                    };
                }

            } else {
                item.otherPartyContact = null;
                item.myContact = null;
            }

            return item;
        });

        res.json({
            success: true,
            matches: safeMatches
        });

    } catch (error) {
        console.log(
            "❌ My Matches Error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: "Match পাওয়া যায়নি।"
        });
    }
});

app.put("/api/matches/:id/accept", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Login required."
            });
        }

        const match =
            await Match.findById(
                req.params.id
            );

        if (!match) {
            return res.status(404).json({
                success: false,
                message: "Match পাওয়া যায়নি।"
            });
        }

        if (
            match.requester.toString() !==
            req.session.userId
        ) {
            return res.status(403).json({
                success: false,
                message: "শুধু Requester Match Accept করতে পারবেন।"
            });
        }

        if (match.status !== "pending") {
            return res.status(400).json({
                success: false,
                message: "এই Match এখন Accept করা যাবে না।"
            });
        }

        match.status = "accepted";
        await match.save();

        res.json({
            success: true,
            message: "✅ Match Accepted হয়েছে। এখন Confirmation করা যাবে।",
            match
        });

    } catch (error) {
        console.log("❌ Match Accept Error:", error.message);

        res.status(500).json({
            success: false,
            message: "Match Accept করা যায়নি।"
        });
    }
});


// ==================================================
// V1 - CONFIRM MATCH + CREATE TWO FEES
// ==================================================

app.post("/api/matches/:id/confirm", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Login required."
            });
        }

        const match =
            await Match.findById(
                req.params.id
            );

        if (!match) {
            return res.status(404).json({
                success: false,
                message: "Match পাওয়া যায়নি।"
            });
        }

        if (
            match.requester.toString() !==
            req.session.userId
        ) {
            return res.status(403).json({
                success: false,
                message: "শুধু Requester Confirmation করতে পারবেন।"
            });
        }

        const result =
            await createConfirmationPayments(
                match._id
            );

        res.json({
            success: true,
            message: "✅ Confirmation তৈরি হয়েছে। দুই পক্ষের ১ টাকা করে Fee নির্ধারিত হয়েছে।",
            match: result.match,
            requesterPayment: {
                id: result.requesterPayment._id,
                amount: result.requesterPayment.amount,
                status: result.requesterPayment.status
            },
            providerPayment: {
                id: result.providerPayment._id,
                amount: result.providerPayment.amount,
                status: result.providerPayment.status
            }
        });

    } catch (error) {
        console.log("❌ Match Confirm Error:", error.message);

        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});


// ==================================================
// V1 - SAVE MATCH CONTACT INFORMATION
// ==================================================

app.put("/api/matches/:id/contact", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Login required."
            });
        }

        const match = await Match.findById(req.params.id);

        if (!match) {
            return res.status(404).json({
                success: false,
                message: "Match পাওয়া যায়নি।"
            });
        }

        const userId = req.session.userId;

        const isRequester =
            match.requester.toString() === userId;

        const isProvider =
            match.provider.toString() === userId;

        if (!isRequester && !isProvider) {
            return res.status(403).json({
                success: false,
                message: "এই Match-এর Contact Information পরিবর্তনের অনুমতি আপনার নেই।"
            });
        }

        // Contact information is available only after confirmation
        if (match.status !== "confirmed") {
            return res.status(400).json({
                success: false,
                message: "দুই পক্ষের Confirmation Payment সম্পন্ন হওয়ার পরেই ঠিকানা ও মোবাইল নম্বর দেওয়া যাবে।"
            });
        }

        const payments = await Payment.find({
            paymentGroupId: "MATCH-" + match._id.toString(),
            paymentType: "confirmation"
        });

        const bothPaid =
            payments.length === 2 &&
            payments.every(
                payment => payment.status === "paid"
            );

        if (!bothPaid) {
            return res.status(400).json({
                success: false,
                message: "দুই পক্ষের ১ টাকা Confirmation Payment সম্পূর্ণ হয়নি।"
            });
        }

        const {
            address,
            mobileNumber1,
            mobileNumber2
        } = req.body;

        if (
            typeof address !== "string" ||
            !address.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "ঠিকানা দিন।"
            });
        }

        if (
            typeof mobileNumber1 !== "string" ||
            !mobileNumber1.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "মোবাইল নম্বর ১ দিন।"
            });
        }

        if (address.trim().length > 500) {
            return res.status(400).json({
                success: false,
                message: "ঠিকানা সর্বোচ্চ ৫০০ অক্ষরের মধ্যে দিন।"
            });
        }

        if (
            mobileNumber1.trim().length > 30 ||
            (
                typeof mobileNumber2 === "string" &&
                mobileNumber2.trim().length > 30
            )
        ) {
            return res.status(400).json({
                success: false,
                message: "মোবাইল নম্বর সঠিকভাবে দিন।"
            });
        }

        const cleanAddress = address.trim();
        const cleanMobile1 = mobileNumber1.trim();
        const cleanMobile2 =
            typeof mobileNumber2 === "string"
                ? mobileNumber2.trim()
                : "";

        if (isRequester) {
            match.requesterAddress = cleanAddress;
            match.requesterMobileNumber1 = cleanMobile1;
            match.requesterMobileNumber2 = cleanMobile2;
        }

        if (isProvider) {
            match.providerAddress = cleanAddress;
            match.providerMobileNumber1 = cleanMobile1;
            match.providerMobileNumber2 = cleanMobile2;
        }

        await match.save();

        res.json({
            success: true,
            message: "✅ ঠিকানা ও মোবাইল নম্বর সফলভাবে সংরক্ষণ হয়েছে।",
            contact: isRequester
                ? {
                    address: match.requesterAddress,
                    mobileNumber1: match.requesterMobileNumber1,
                    mobileNumber2: match.requesterMobileNumber2
                }
                : {
                    address: match.providerAddress,
                    mobileNumber1: match.providerMobileNumber1,
                    mobileNumber2: match.providerMobileNumber2
                }
        });

    } catch (error) {
        console.log(
            "❌ Match Contact Save Error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: "Contact Information সংরক্ষণ করা যায়নি।"
        });
    }
});


// ==================================================
// V1 - COMPLETE CONFIRMATION PAYMENT
// ==================================================

app.post("/api/payment/confirmation/complete", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Login required."
            });
        }

        const {
            paymentId,
            transactionId
        } = req.body;

        if (!paymentId) {
            return res.status(400).json({
                success: false,
                message: "Payment ID দিন।"
            });
        }

        const payment =
            await completeConfirmationPayment(
                paymentId,
                req.session.userId,
                transactionId || null
            );

        const groupPayments =
            await Payment.find({
                paymentGroupId:
                    payment.paymentGroupId,
                paymentType:
                    "confirmation"
            });

        const bothPaid =
            groupPayments.length === 2 &&
            groupPayments.every(
                item => item.status === "paid"
            );

        res.json({
            success: true,
            message: "✅ আপনার ১ টাকার Confirmation Fee Paid হয়েছে।",
            payment: {
                id: payment._id,
                amount: payment.amount,
                status: payment.status,
                transactionId: payment.transactionId,
                paidAt: payment.paidAt
            },
            bothPaid
        });

    } catch (error) {
        console.log("❌ Confirmation Payment Error:", error.message);

        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});


// ==================================================
// CURRENT USER
// ==================================================

app.get(
    "/api/me",
    async (req, res) => {

        try {

            if (!req.session.userId) {

                return res.json({

                    success: false,

                    loggedIn: false

                });

            }


            const user =
                await User.findById(
                    req.session.userId
                ).select("-password");


            if (!user) {

                req.session.destroy();

                return res.json({

                    success: false,

                    loggedIn: false

                });

            }


            res.json({

                success: true,

                loggedIn: true,

                user:
                    user

            });


        } catch (error) {

            console.log(
                "❌ /api/me Error:",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "User তথ্য পাওয়া যায়নি।"

            });

        }

    }
);


// ==================================================
// LOGOUT
// ==================================================

app.post(
    "/api/logout",
    (req, res) => {

        req.session.destroy(
            (error) => {

                if (error) {

                    return res.status(500).json({

                        success: false,

                        message:
                            "Logout করা যায়নি।"

                    });

                }


                res.json({

                    success: true,

                    message:
                        "✅ Logout সফল হয়েছে।"

                });

            }
        );

    }
);


// ==================================================
// FORGOT PASSWORD - SEND OTP
// ==================================================

app.post(
    "/api/forgot-password",
    passwordResetRateLimit,
    async (req, res) => {

        try {

            const {
                phone
            } = req.body;


            if (!phone) {

                return res.status(400).json({

                    success: false,

                    message:
                        "মোবাইল নম্বর দিন।"

                });

            }


            const user =
                await User.findOne({
                    phone: phone
                });


            if (!user) {

                return res.status(404).json({

                    success: false,

                    message:
                        "এই মোবাইল নম্বর দিয়ে কোনো account পাওয়া যায়নি।"

                });

            }


            // ৬ সংখ্যার OTP

            const otp =
                Math.floor(
                    100000 +
                    Math.random() *
                    900000
                ).toString();


            // Session-এ OTP রাখা

            req.session.resetPhone =
                phone;

            req.session.resetOtp =
                otp;

            req.session.resetOtpExpiry =
                Date.now() +
                (
                    5 *
                    60 *
                    1000
                );


            console.log(
                `🔐 Password Reset OTP for ${phone}: ${otp}`
            );


            res.json({

                success: true,

                message:
                    "OTP তৈরি হয়েছে।",

                // TEST VERSION
                testOtp:
                    otp

            });


        } catch (error) {

            console.log(
                "❌ Forgot Password Error:",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "OTP তৈরি করা যায়নি।"

            });

        }

    }
);


// ==================================================
// RESET PASSWORD
// ==================================================

app.post(
    "/api/reset-password",
    passwordResetRateLimit,
    async (req, res) => {

        try {

            const {
                phone,
                otp,
                newPassword
            } = req.body;


            if (
                !phone ||
                !otp ||
                !newPassword
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "সব তথ্য পূরণ করুন।"

                });

            }


            if (
                req.session.resetPhone !==
                    phone ||
                req.session.resetOtp !==
                    otp
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "OTP সঠিক নয়।"

                });

            }


            if (
                !req.session.resetOtpExpiry ||
                Date.now() >
                    req.session.resetOtpExpiry
            ) {

                req.session.resetPhone =
                    null;

                req.session.resetOtp =
                    null;

                req.session.resetOtpExpiry =
                    null;


                return res.status(400).json({

                    success: false,

                    message:
                        "OTP-এর সময় শেষ হয়ে গেছে। নতুন OTP নিন।"

                });

            }


            if (
                newPassword.length <
                6
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Password কমপক্ষে ৬ অক্ষরের হতে হবে।"

                });

            }


            const user =
                await User.findOne({
                    phone: phone
                });


            if (!user) {

                return res.status(404).json({

                    success: false,

                    message:
                        "User পাওয়া যায়নি।"

                });

            }


            user.password =
                await bcrypt.hash(
                    newPassword,
                    10
                );


            await user.save();


            // OTP একবার ব্যবহার হওয়ার পর
            // Session থেকে মুছে দেওয়া

            req.session.resetPhone =
                null;

            req.session.resetOtp =
                null;

            req.session.resetOtpExpiry =
                null;


            res.json({

                success: true,

                message:
                    "Password সফলভাবে পরিবর্তন হয়েছে।"

            });


        } catch (error) {

            console.log(
                "❌ Password Reset Error:",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "Password পরিবর্তন করা যায়নি।"

            });

        }

    }
);


// ==================================================
// ADMIN - GET ALL USERS
// ==================================================

app.get(
    "/api/admin/users",
    requireAdmin,
    async (req, res) => {

        try {

            const page = Math.max(Number.parseInt(req.query.page || "1", 10), 1);
            const pageSize = Math.min(Math.max(Number.parseInt(req.query.pageSize || "50", 10), 1), 100);
            const cursor = req.query.cursor ? String(req.query.cursor) : null;

            let cursorDate = null;
            let cursorId = null;

            if (cursor) {
                try {
                    const decoded = JSON.parse(
                        Buffer.from(cursor, "base64url").toString("utf8")
                    );

                    cursorDate = new Date(decoded.createdAt);
                    cursorId = String(decoded.id);

                    if (
                        !Number.isFinite(cursorDate.getTime()) ||
                        !/^[a-fA-F0-9]{24}$/.test(cursorId)
                    ) {
                        throw new Error("invalid cursor");
                    }
                } catch {
                    return res.status(400).json({
                        success: false,
                        message: "অবৈধ cursor।"
                    });
                }
            }

            const userFilter = cursor
                ? {
                    $or: [
                        { createdAt: { $lt: cursorDate } },
                        {
                            createdAt: cursorDate,
                            _id: {
                                $lt: new mongoose.Types.ObjectId(cursorId)
                            }
                        }
                    ]
                }
                : {};

            const users = await User.find(userFilter)
                .select("-password")
                .sort({ createdAt: -1, _id: -1 })
                .limit(pageSize + 1)
                .lean();

            const hasMore = users.length > pageSize;
            const items = users.slice(0, pageSize);
            const lastItem = items[items.length - 1];

            const nextCursor = hasMore && lastItem
                ? Buffer.from(
                    JSON.stringify({
                        createdAt: lastItem.createdAt,
                        id: String(lastItem._id)
                    })
                ).toString("base64url")
                : null;


            res.json({

                success: true,

                users:
                    items,

                hasMore,

                nextCursor

            });


        } catch (error) {

            console.log(
                "❌ Admin Users Error:",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "User তথ্য পাওয়া যায়নি।"

            });

        }

    }
);


// ==================================================
// ADMIN - BLOCK USER
// ==================================================

app.put(
    "/api/admin/users/:id/block",
    requireAdmin,
    async (req, res) => {

        try {

            const userId =
                req.params.id;


            // Admin নিজেকে Block করতে পারবে না

            if (
                userId ===
                req.admin._id.toString()
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Admin নিজেকে Block করতে পারবেন না।"

                });

            }


            const user =
                await User.findById(
                    userId
                );


            if (!user) {

                return res.status(404).json({

                    success: false,

                    message:
                        "User পাওয়া যায়নি।"

                });

            }


            if (
                user.accountStatus ===
                "blocked"
            ) {

                user.accountStatus =
                    "active";

                await user.save();


                return res.json({

                    success: true,

                    message:
                        "✅ User Unblock হয়েছে।"

                });

            }


            user.accountStatus =
                "blocked";


            await user.save();


            res.json({

                success: true,

                message:
                    "🚫 User Block হয়েছে।"

            });


        } catch (error) {

            console.log(
                "❌ Block User Error:",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "User Block/Unblock করা যায়নি।"

            });

        }

    }
);


// ==================================================
// ADMIN - DELETE USER
// ==================================================

app.delete(
    "/api/admin/users/:id",
    requireAdmin,
    async (req, res) => {

        try {

            const userId =
                req.params.id;


            // Admin নিজেকে Delete করতে পারবে না

            if (
                userId ===
                req.admin._id.toString()
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Admin নিজেকে Delete করতে পারবেন না।"

                });

            }


            const user =
                await User.findById(
                    userId
                );


            if (!user) {

                return res.status(404).json({

                    success: false,

                    message:
                        "User পাওয়া যায়নি।"

                });

            }


            // নিরাপত্তার জন্য অন্য Admin
            // Delete করা যাবে না

            if (
                user.role ===
                "admin"
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "অন্য Admin account Delete করা যাবে না।"

                });

            }


            await User.findByIdAndDelete(
                userId
            );


            res.json({

                success: true,

                message:
                    "🗑️ User সফলভাবে Delete হয়েছে।"

            });


        } catch (error) {

            console.log(
                "❌ Delete User Error:",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "User Delete করা যায়নি।"

            });

        }

    }
);


// ==================================================
// GET ALL SHOPS
// ==================================================

app.get(
    "/api/shops",
    async (req, res) => {

        try {

            const page = Math.max(Number.parseInt(req.query.page || "1", 10), 1);
            const pageSize = Math.min(Math.max(Number.parseInt(req.query.pageSize || "50", 10), 1), 100);
            const cursor = req.query.cursor ? String(req.query.cursor) : null;

            let cursorDate = null;
            let cursorId = null;

            if (cursor) {
                try {
                    const decoded = JSON.parse(
                        Buffer.from(cursor, "base64url").toString("utf8")
                    );

                    cursorDate = new Date(decoded.createdAt);
                    cursorId = String(decoded.id);

                    if (
                        !Number.isFinite(cursorDate.getTime()) ||
                        !/^[a-fA-F0-9]{24}$/.test(cursorId)
                    ) {
                        throw new Error("invalid cursor");
                    }
                } catch {
                    return res.status(400).json({
                        success: false,
                        message: "অবৈধ cursor।"
                    });
                }
            }

            const shopFilter = cursor
                ? {
                    $or: [
                        { createdAt: { $lt: cursorDate } },
                        {
                            createdAt: cursorDate,
                            _id: {
                                $lt: new mongoose.Types.ObjectId(cursorId)
                            }
                        }
                    ]
                }
                : {};

            const shops = await Shop.find(shopFilter)
                .sort({ createdAt: -1, _id: -1 })
                .limit(pageSize + 1)
                .lean();

            const hasMore = shops.length > pageSize;
            const items = shops.slice(0, pageSize);
            const lastItem = items[items.length - 1];

            const nextCursor = hasMore && lastItem
                ? Buffer.from(
                    JSON.stringify({
                        createdAt: lastItem.createdAt,
                        id: String(lastItem._id)
                    })
                ).toString("base64url")
                : null;


            res.json({

                success: true,

                shops:
                    items,

                hasMore,

                nextCursor

            });


        } catch (error) {

            console.log(
                "❌ Shop Fetch Error:",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "দোকানের তথ্য পাওয়া যায়নি।",

                error:
                    error.message

            });

        }

    }
);


// ==================================================
// ADD SHOP
// ==================================================

app.post(
    "/api/shops",
    async (req, res) => {

        try {

            const shop =
                new Shop(
                    req.body
                );


            const savedShop =
                await shop.save();


            res.status(201).json({

                success: true,

                message:
                    "দোকান সফলভাবে যোগ হয়েছে।",

                shop:
                    savedShop

            });


        } catch (error) {

            console.log(
                "❌ Shop Save Error:",
                error.message
            );


            res.status(400).json({

                success: false,

                message:
                    "দোকান যোগ করা যায়নি।",

                error:
                    error.message

            });

        }

    }
);


// ==================================================
// ADMIN - APPROVE SHOP
// ==================================================

app.put(
    "/api/admin/shops/:id/approve",
    requireAdmin,
    async (req, res) => {

        try {

            const shop =
                await Shop.findById(
                    req.params.id
                );


            if (!shop) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Shop পাওয়া যায়নি।"

                });

            }


            shop.isApproved =
                true;


            await shop.save();


            res.json({

                success: true,

                message:
                    "✅ Shop Approved হয়েছে।"

            });


        } catch (error) {

            console.log(
                "❌ Approve Shop Error:",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "Shop Approve করা যায়নি।"

            });

        }

    }
);


// ==================================================
// ==================================================
// ADMIN - APPROVE PRODUCT
// ==================================================

app.put(
    "/api/admin/products/:id/approve",
    requireAdmin,
    async (req, res) => {
        try {
            const product = await Product.findById(req.params.id);

            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: "Product পাওয়া যায়নি।"
                });
            }

            if (product.status !== "paid") {
                return res.status(400).json({
                    success: false,
                    message: "Payment Paid না হলে Product Approve করা যাবে না।"
                });
            }

            product.status = "approved";
            product.approvedBy = req.admin._id;
            product.approvedAt = new Date();

            await product.save();

            return res.json({
                success: true,
                message: "✅ Product Approved হয়েছে। এখন Publish করা যাবে।",
                product
            });

        } catch (error) {
            console.log("❌ Approve Product Error:", error.message);

            return res.status(500).json({
                success: false,
                message: "Product Approve করা যায়নি।"
            });
        }
    }
);

// ==================================================
// ADMIN - PUBLISH PRODUCT
// ==================================================

app.put(
    "/api/admin/products/:id/publish",
    requireAdmin,
    async (req, res) => {
        try {
            const product = await Product.findById(req.params.id);

            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: "Product পাওয়া যায়নি।"
                });
            }

            if (product.status !== "approved") {
                return res.status(400).json({
                    success: false,
                    message: "শুধু Approved Product Publish করা যাবে।"
                });
            }

            product.status = "published";
            product.publishedAt = new Date();

            await product.save();

            return res.json({
                success: true,
                message: "✅ Product Published হয়েছে।",
                product
            });

        } catch (error) {
            console.log("❌ Publish Product Error:", error.message);

            return res.status(500).json({
                success: false,
                message: "Product Publish করা যায়নি।"
            });
        }
    }
);

// ADMIN - APPROVE SERVICE
// ==================================================

app.put(
    "/api/admin/services/:id/approve",
    requireAdmin,
    async (req, res) => {
        try {
            const service =
                await Service.findById(
                    req.params.id
                );

            if (!service) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Service পাওয়া যায়নি।"
                });
            }

            if (service.status !== "paid") {
                return res.status(400).json({
                    success: false,
                    message:
                        "Payment Paid না হলে Service Approve করা যাবে না।"
                });
            }

            service.status =
                "approved";

            service.approvedBy =
                req.admin._id;

            service.approvedAt =
                new Date();

            await service.save();

            return res.json({
                success: true,
                message:
                    "✅ Service Approved হয়েছে। এখন Publish করা যাবে।",
                service
            });

        } catch (error) {
            console.log(
                "❌ Approve Service Error:",
                error.message
            );

            return res.status(500).json({
                success: false,
                message:
                    "Service Approve করা যায়নি।"
            });
        }
    }
);


// ==================================================
// ADMIN - PUBLISH SERVICE
// ==================================================

app.put(
    "/api/admin/services/:id/publish",
    requireAdmin,
    async (req, res) => {
        try {
            const service =
                await Service.findById(
                    req.params.id
                );

            if (!service) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Service পাওয়া যায়নি।"
                });
            }

            if (service.status !== "approved") {
                return res.status(400).json({
                    success: false,
                    message:
                        "শুধু Approved Service Publish করা যাবে।"
                });
            }

            service.status =
                "published";

            service.publishedAt =
                new Date();

            await service.save();

            return res.json({
                success: true,
                message:
                    "✅ Service Published হয়েছে।",
                service
            });

        } catch (error) {
            console.log(
                "❌ Publish Service Error:",
                error.message
            );

            return res.status(500).json({
                success: false,
                message:
                    "Service Publish করা যায়নি।"
            });
        }
    }
);


// ==================================================
// ADMIN - DELETE SHOP
// ==================================================

app.delete(
    "/api/admin/shops/:id",
    requireAdmin,
    async (req, res) => {

        try {

            const shop =
                await Shop.findById(
                    req.params.id
                );


            if (!shop) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Shop পাওয়া যায়নি।"

                });

            }


            await Shop.findByIdAndDelete(
                req.params.id
            );


            res.json({

                success: true,

                message:
                    "🗑️ Shop সফলভাবে Delete হয়েছে।"

            });


        } catch (error) {

            console.log(
                "❌ Delete Shop Error:",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "Shop Delete করা যায়নি।"

            });

        }

    }
);



// ==================================================
// V1 - DEAL CHAT
// ==================================================

function isDealParticipant(match, userId) {
    const id = userId.toString();

    return (
        match.requester.toString() === id ||
        match.provider.toString() === id
    );
}


// ==================================================
// GET DEAL CHAT
// ==================================================

app.get("/api/deal-chat/:matchId", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Login required."
            });
        }

        const match = await Match.findById(req.params.matchId);

        if (!match) {
            return res.status(404).json({
                success: false,
                message: "Match পাওয়া যায়নি।"
            });
        }

        if (!isDealParticipant(match, req.session.userId)) {
            return res.status(403).json({
                success: false,
                message: "এই Chat আপনার জন্য নয়।"
            });
        }

        let chat = await DealChat.findOne({
            match: match._id
        });

        if (!chat) {
            chat = await DealChat.create({
                match: match._id,
                requester: match.requester,
                provider: match.provider
            });
        }

        res.json({
            success: true,
            chat
        });

    } catch (error) {
        console.log("❌ Deal Chat Load Error:", error.message);

        res.status(500).json({
            success: false,
            message: "Chat পাওয়া যায়নি।"
        });
    }
});


// ==================================================
// SEND DEAL CHAT MESSAGE / OFFER
// ==================================================

app.post("/api/deal-chat/:matchId/message", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Login required."
            });
        }

        const match = await Match.findById(req.params.matchId);

        if (!match) {
            return res.status(404).json({
                success: false,
                message: "Match পাওয়া যায়নি।"
            });
        }

        if (!isDealParticipant(match, req.session.userId)) {
            return res.status(403).json({
                success: false,
                message: "এই Chat-এ আপনার অনুমতি নেই।"
            });
        }

        if (
            ["confirmed", "completed", "cancelled"]
                .includes(match.status)
        ) {
            return res.status(400).json({
                success: false,
                message: "এই Match-এর দরদাম Chat আর চালু নেই।"
            });
        }

        let text =
            typeof req.body.text === "string"
                ? req.body.text.trim()
                : "";

        const type =
            req.body.type === "offer"
                ? "offer"
                : "text";


        // ==================================================
        // MOBILE / PHONE NUMBER BLOCK
        // ==================================================

        const mobilePatterns = [
            /\+?\d[\d\s().-]{7,}\d/,
            /\b00\d{8,15}\b/,
            /\b\d{10,15}\b/,
            /\b01\d{9}\b/,
            /\b(?:\+?88)?01\d{9}\b/
        ];

        if (
            mobilePatterns.some(pattern => pattern.test(text))
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "❌ Chat-এ কোনো Mobile বা Phone Number দেওয়া যাবে না।"
            });
        }


        // ==================================================
        // CONTACT INFORMATION BLOCK
        // ==================================================

        const contactPattern =
            /\b(phone|mobile|whatsapp|imo|telegram|viber|call|contact|number)\b/i;

        const banglaContactPattern =
            /(মোবাইল|ফোন|হোয়াটসঅ্যাপ|হোয়াটসঅ্যাপ|ইমো|টেলিগ্রাম|ভাইবার|কল|নম্বর|যোগাযোগ)/i;

        if (
            contactPattern.test(text) ||
            banglaContactPattern.test(text)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "❌ Chat-এ Contact Information দেওয়া যাবে না।"
            });
        }


        // ==================================================
        // MESSAGE LIMIT
        // ==================================================

        if (text.length > 500) {
            return res.status(400).json({
                success: false,
                message:
                    "❌ Message সর্বোচ্চ 500 character হতে পারবে।"
            });
        }


        // ==================================================
        // OFFER
        // সর্বোচ্চ ৬ digit
        // Format: 25000/=
        // ==================================================

        if (type === "offer") {

            const amount = Number(req.body.amount);

            if (
                !Number.isInteger(amount) ||
                amount < 1 ||
                amount > 999999
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "❌ দরদামের টাকা ১ থেকে ৬ digit-এর মধ্যে হতে হবে।"
                });
            }

            const offerText =
                amount.toString() + "/=";

            const chat =
                await DealChat.findOneAndUpdate(
                    {
                        match: match._id
                    },
                    {
                        $setOnInsert: {
                            match: match._id,
                            requester: match.requester,
                            provider: match.provider
                        },

                        $push: {
                            messages: {
                                sender: req.session.userId,
                                text: offerText,
                                type: "offer",
                                amount: amount
                            }
                        },

                        $set: {
                            lastOfferAmount: amount,
                            lastOfferBy: req.session.userId,
                            dealStatus: "deal_proposed"
                        }
                    },
                    {
                        new: true,
                        upsert: true
                    }
                );

            return res.json({
                success: true,
                message: "✅ দরদাম পাঠানো হয়েছে।",
                chat
            });
        }


        // ==================================================
        // NORMAL LIMITED CHAT
        // ==================================================

        if (!text) {
            return res.status(400).json({
                success: false,
                message: "Message লিখুন।"
            });
        }

        const chat =
            await DealChat.findOneAndUpdate(
                {
                    match: match._id
                },
                {
                    $setOnInsert: {
                        match: match._id,
                        requester: match.requester,
                        provider: match.provider
                    },

                    $push: {
                        messages: {
                            sender: req.session.userId,
                            text: text,
                            type: "text",
                            amount: null
                        }
                    }
                },
                {
                    new: true,
                    upsert: true
                }
            );

        res.json({
            success: true,
            message: "✅ Message পাঠানো হয়েছে।",
            chat
        });

    } catch (error) {
        console.log("❌ Deal Chat Message Error:", error.message);

        res.status(500).json({
            success: false,
            message: "Message পাঠানো যায়নি।"
        });
    }
});


// ==================================================
// AGREE LAST OFFER
// ==================================================

app.post("/api/deal-chat/:matchId/agree", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Login required."
            });
        }

        const match = await Match.findById(req.params.matchId);

        if (!match) {
            return res.status(404).json({
                success: false,
                message: "Match পাওয়া যায়নি।"
            });
        }

        if (!isDealParticipant(match, req.session.userId)) {
            return res.status(403).json({
                success: false,
                message: "এই Deal আপনার নয়।"
            });
        }

        const chat = await DealChat.findOne({
            match: match._id
        });

        if (!chat || !chat.lastOfferAmount) {
            return res.status(400).json({
                success: false,
                message: "❌ আগে একটি দরদাম দিন।"
            });
        }

        if (
            chat.lastOfferBy &&
            chat.lastOfferBy.toString() === req.session.userId
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "❌ নিজের দেওয়া দরদাম নিজে Final করা যাবে না। অপর পক্ষকে Agree করতে হবে।"
            });
        }

        chat.agreedAmount = chat.lastOfferAmount;
        chat.dealStatus = "agreed";

        await chat.save();

        res.json({
            success: true,
            message: "✅ দরদাম চূড়ান্ত হয়েছে।",
            agreedAmount: chat.agreedAmount,
            chat
        });

    } catch (error) {
        console.log("❌ Deal Agree Error:", error.message);

        res.status(500).json({
            success: false,
            message: "দরদাম চূড়ান্ত করা যায়নি।"
        });
    }
});


// ==================================================
// V1 - COMPLETE MATCH
// ==================================================

app.put("/api/matches/:id/complete", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Login required."
            });
        }

        const match = await Match.findById(req.params.id);

        if (!match) {
            return res.status(404).json({
                success: false,
                message: "Match পাওয়া যায়নি।"
            });
        }

        const userId = req.session.userId;

        const isRequester =
            match.requester.toString() === userId;

        const isProvider =
            match.provider.toString() === userId;

        if (!isRequester && !isProvider) {
            return res.status(403).json({
                success: false,
                message: "শুধু Match-এর দুই পক্ষ Complete করতে পারবেন।"
            });
        }

        if (match.status !== "confirmed") {
            return res.status(400).json({
                success: false,
                message: "শুধু Confirmed Match Complete করা যাবে।"
            });
        }

        match.status = "completed";
        match.completedAt = new Date();

        await match.save();

        const request = await Request.findById(match.request);

        if (request && request.status !== "completed") {
            request.status = "completed";
            await request.save();
        }

        res.json({
            success: true,
            message: "✅ Match সফলভাবে Completed হয়েছে।",
            match
        });

    } catch (error) {
        console.log("❌ Complete Match Error:", error.message);

        res.status(500).json({
            success: false,
            message: "Match Complete করা যায়নি।"
        });
    }
});


// ==================================================
// V1 - CREATE SERVICE
// ==================================================

app.post("/api/services", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Login required."
            });
        }

        const {
            name,
            description,
            category,
            subcategory,
            price,
            priceType,
            district,
            upazila,
            union,
            village,
            phone,
            image,
            benefits,
            latitude,
            longitude
        } = req.body;

        if (!name || !String(name).trim()) {
            return res.status(400).json({
                success: false,
                message: "Service-এর নাম দিন।"
            });
        }

        if (!description || !String(description).trim()) {
            return res.status(400).json({
                success: false,
                message: "Service-এর বিস্তারিত দিন।"
            });
        }

        const service = await Service.create({
            owner: req.session.userId,

            name: String(name).trim(),

            description:
                String(description).trim(),

            category:
                category
                    ? String(category).trim()
                    : "",

            subcategory:
                subcategory
                    ? String(subcategory).trim()
                    : "",

            price:
                Number(price) || 0,

            priceType:
                priceType &&
                [
                    "fixed",
                    "hourly",
                    "daily",
                    "negotiable"
                ].includes(priceType)
                    ? priceType
                    : "negotiable",

            district:
                district
                    ? String(district).trim()
                    : "",

            upazila:
                upazila
                    ? String(upazila).trim()
                    : "",

            union:
                union
                    ? String(union).trim()
                    : "",

            village:
                village
                    ? String(village).trim()
                    : "",

            phone:
                String(phone).trim(),

            image:
                image
                    ? String(image).trim()
                    : "",

            benefits: Array.isArray(benefits)
                ? benefits
                    .map(item => String(item).trim())
                    .filter(Boolean)
                    .slice(0, 7)
                : [],

            status: "draft"
        });

        return res.status(201).json({
            success: true,
            message:
                "✅ Service সফলভাবে সংরক্ষণ হয়েছে। এখন ১ টাকা Listing Fee Payment করতে হবে।",
            service
        });

    } catch (error) {
        console.log(
            "❌ Create Service Error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message:
                "Service তৈরি করা যায়নি।"
        });
    }
});


// ==================================================
// V1 - CREATE PRODUCT
// ==================================================

app.post("/api/products", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Login required."
            });
        }

        const {
            name,
            description,
            category,
            subcategory,
            price,
            unit,
            district,
            upazila,
            union,
            village,
            phone,
            image,
            benefits,
            latitude,
            longitude
        } = req.body;

        // ========================================
        // STEP 5G-31 PRODUCT LOCATION SERVER
        // ========================================



        if (!name || !String(name).trim()) {
            return res.status(400).json({
                success: false,
                message: "Product-এর নাম দিন।"
            });
        }

        const product = await Product.create({
            owner: req.session.userId,
            name: String(name).trim(),
            description: description
                ? String(description).trim()
                : "",
            category: category
                ? String(category).trim()
                : "",
            subcategory: subcategory
                ? String(subcategory).trim()
                : "",
            price: Number(price) || 0,
            unit: unit
                ? String(unit).trim()
                : "",
            district: district
                ? String(district).trim()
                : "",
            upazila: upazila
                ? String(upazila).trim()
                : "",
            union: union
                ? String(union).trim()
                : "",
            village: village
                ? String(village).trim()
                : "",

            latitude:
                latitude === null ||
                latitude === undefined ||
                latitude === ""
                    ? null
                    : Number(latitude),

            longitude:
                longitude === null ||
                longitude === undefined ||
                longitude === ""
                    ? null
                    : Number(longitude),

            ...(Number.isFinite(Number(latitude)) &&
               Number.isFinite(Number(longitude))
                ? {
                    location: {
                        type: "Point",
                        coordinates: [
                            Number(longitude),
                            Number(latitude)
                        ]
                    }
                }
                : {}),

            phone: phone
                ? String(phone).trim()
                : "",
            image: image
                ? String(image).trim()
                : "",

            benefits: Array.isArray(benefits)
                ? benefits
                    .map(item => String(item).trim())
                    .filter(Boolean)
                    .slice(0, 7)
                : [],

            status: "draft"
        });

        return res.status(201).json({
            success: true,
            message: "✅ Product সফলভাবে সংরক্ষণ হয়েছে। Admin Approval-এর অপেক্ষায় আছে।",
            product
        });

    } catch (error) {
        console.log("❌ Create Product Error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Product তৈরি করা যায়নি।"
        });
    }
});


// ==================================================
// V1 - CREATE SERVICE PAYMENT
// ==================================================

app.post("/api/payment/service/create", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Login required."
            });
        }

        const { serviceId } = req.body;

        if (!serviceId) {
            return res.status(400).json({
                success: false,
                message: "Service ID দিন।"
            });
        }

        const result =
            await createServicePayment(
                serviceId,
                req.session.userId
            );

        return res.json({
            success: true,
            message:
                "✅ Service Payment তৈরি হয়েছে। ১ টাকা Payment করুন।",
            service: {
                id: result.service._id,
                status: result.service.status,
                paymentId: result.service.paymentId
            },
            payment: {
                id: result.payment._id,
                amount: result.payment.amount,
                status: result.payment.status,
                paymentType: result.payment.paymentType
            }
        });

    } catch (error) {
        console.log(
            "❌ Create Service Payment Error:",
            error.message
        );

        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
});


// ==================================================
// V1 - COMPLETE SERVICE PAYMENT
// ==================================================

app.post("/api/payment/service/complete", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Login required."
            });
        }

        const {
            paymentId,
            transactionId
        } = req.body;

        if (!paymentId) {
            return res.status(400).json({
                success: false,
                message: "Payment ID দিন।"
            });
        }

        const result =
            await completeServicePayment(
                paymentId,
                req.session.userId,
                transactionId || null
            );

        return res.json({
            success: true,
            message:
                "✅ Service Payment সফল হয়েছে। Service এখন Admin Approval-এর অপেক্ষায় আছে।",
            service: {
                id: result.service._id,
                status: result.service.status,
                paymentId: result.service.paymentId
            },
            payment: {
                id: result.payment._id,
                amount: result.payment.amount,
                status: result.payment.status,
                transactionId:
                    result.payment.transactionId,
                paidAt:
                    result.payment.paidAt
            }
        });

    } catch (error) {
        console.log(
            "❌ Complete Service Payment Error:",
            error.message
        );

        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
});


// ==================================================
// V1 - CREATE PRODUCT PAYMENT
// ==================================================

app.post("/api/payment/product/create", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Login required."
            });
        }

        const { productId } = req.body;

        if (!productId) {
            return res.status(400).json({
                success: false,
                message: "Product ID দিন।"
            });
        }

        const result =
            await createProductPayment(
                productId,
                req.session.userId
            );

        return res.json({
            success: true,
            message: "✅ Product Payment তৈরি হয়েছে। ১ টাকা Payment করুন।",
            product: {
                id: result.product._id,
                status: result.product.status,
                paymentId: result.product.paymentId
            },
            payment: {
                id: result.payment._id,
                amount: result.payment.amount,
                status: result.payment.status,
                paymentType: result.payment.paymentType
            }
        });

    } catch (error) {
        console.log("❌ Create Product Payment Error:", error.message);

        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
});


// ==================================================
// V1 - COMPLETE PRODUCT PAYMENT
// ==================================================

app.post("/api/payment/product/complete", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Login required."
            });
        }

        const {
            paymentId,
            transactionId
        } = req.body;

        if (!paymentId) {
            return res.status(400).json({
                success: false,
                message: "Payment ID দিন।"
            });
        }

        const result =
            await completeProductPayment(
                paymentId,
                req.session.userId,
                transactionId || null
            );

        return res.json({
            success: true,
            message: "✅ Product Payment সফল হয়েছে। Product এখন Admin Approval-এর অপেক্ষায় আছে।",
            product: {
                id: result.product._id,
                status: result.product.status,
                paymentId: result.product.paymentId
            },
            payment: {
                id: result.payment._id,
                amount: result.payment.amount,
                status: result.payment.status,
                transactionId: result.payment.transactionId,
                paidAt: result.payment.paidAt
            }
        });

    } catch (error) {
        console.log("❌ Complete Product Payment Error:", error.message);

        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
});


// ==================================================
// V1 - MY PRODUCTS
// ==================================================

app.get("/api/products/my", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Login required."
            });
        }

        const page = Math.max(Number.parseInt(req.query.page || "1", 10), 1);
        const pageSize = Math.min(
            Math.max(Number.parseInt(req.query.pageSize || "50", 10), 1),
            100
        );

        const cursor = req.query.cursor
            ? String(req.query.cursor)
            : null;

        let cursorDate = null;
        let cursorId = null;

        if (cursor) {
            try {
                const decoded = JSON.parse(
                    Buffer.from(cursor, "base64url").toString("utf8")
                );

                cursorDate = new Date(decoded.createdAt);
                cursorId = String(decoded.id);

                if (
                    !Number.isFinite(cursorDate.getTime()) ||
                    !/^[a-fA-F0-9]{24}$/.test(cursorId)
                ) {
                    throw new Error("invalid cursor");
                }
            } catch {
                return res.status(400).json({
                    success: false,
                    message: "অবৈধ cursor।"
                });
            }
        }

        const productFilter = {
            owner: req.session.userId,
            ...(cursor
                ? {
                    $or: [
                        { createdAt: { $lt: cursorDate } },
                        {
                            createdAt: cursorDate,
                            _id: {
                                $lt: new mongoose.Types.ObjectId(cursorId)
                            }
                        }
                    ]
                }
                : {})
        };

        const products = await Product.find(productFilter)
            .sort({ createdAt: -1, _id: -1 })
            .limit(pageSize + 1)
            .lean();

        const hasMore = products.length > pageSize;
        const items = products.slice(0, pageSize);
        const lastItem = items[items.length - 1];

        const nextCursor = hasMore && lastItem
            ? Buffer.from(
                JSON.stringify({
                    createdAt: lastItem.createdAt,
                    id: String(lastItem._id)
                })
            ).toString("base64url")
            : null;

        return res.json({
            success: true,
            products: items,
            hasMore,
            nextCursor
        });

    } catch (error) {
        console.log("❌ My Products Error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Product পাওয়া যায়নি।"
        });
    }
});


// ==================================================
// V1 - PUBLISHED PRODUCTS
// ==================================================


// ==================================================
// STEP 5G-38 — SAFE NEARBY PRODUCT QUERY
// ==================================================

app.get("/api/products/nearby", async (req, res) => {
    try {
        const latitude = Number(req.query.latitude);
        const longitude = Number(req.query.longitude);
        const radiusKm = Number(req.query.radiusKm || 10);

        const page = Math.max(
            Number.parseInt(req.query.page || "1", 10),
            1
        );

        const pageSize = Math.min(
            Math.max(
                Number.parseInt(req.query.pageSize || "20", 10),
                1
            ),
            50
        );
        // STEP 5G-44I-CURSOR-V3
        const cursor = req.query.cursor
            ? String(req.query.cursor)
            : null;

        let cursorDistanceMeters = null;
        let cursorId = null;

        if (cursor) {
            try {
                const decoded = JSON.parse(
                    Buffer.from(cursor, "base64url").toString("utf8")
                );

                cursorDistanceMeters = Number(decoded.distanceMeters);
                cursorId = String(decoded.id);

                if (
                    !Number.isFinite(cursorDistanceMeters) ||
                    !/^[a-fA-F0-9]{24}$/.test(cursorId)
                ) {
                    throw new Error("invalid cursor");
                }
            } catch {
                return res.status(400).json({
                    success: false,
                    message: "অবৈধ cursor।"
                });
            }
        }


        if (!Number.isFinite(latitude) ||
            !Number.isFinite(longitude)) {
            return res.status(400).json({
                success: false,
                message: "সঠিক latitude ও longitude দিন।"
            });
        }

        if (
            latitude < -90 ||
            latitude > 90 ||
            longitude < -180 ||
            longitude > 180
        ) {
            return res.status(400).json({
                success: false,
                message: "অবৈধ latitude/longitude।"
            });
        }

        if (
            !Number.isFinite(radiusKm) ||
            radiusKm <= 0 ||
            radiusKm > 100
        ) {
            return res.status(400).json({
                success: false,
                message: "radiusKm 0 থেকে 100-এর মধ্যে হতে হবে।"
            });
        }

        const skip = cursor ? 0 : (page - 1) * pageSize;

        const results = await Product.aggregate([
            {
                $geoNear: {
                    near: {
                        type: "Point",
                        coordinates: [longitude, latitude]
                    },
                    key: "location",
                    distanceField: "distanceMeters",
                    maxDistance: radiusKm * 1000,
                    spherical: true,
                    query: {
                        status: "published"
                    }
                }
            },
            ...(cursor ? [{
                $match: {
                    $or: [
                        {
                            distanceMeters: {
                                $gt: cursorDistanceMeters
                            }
                        },
                        {
                            distanceMeters: cursorDistanceMeters,
                            _id: {
                                $gt: new mongoose.Types.ObjectId(cursorId)
                            }
                        }
                    ]
                }
            }] : []),
            {
                $skip: skip
            },
            {
                $limit: pageSize + 1
            },
            {
                $set: {
                    distanceKm: {
                        $round: [
                            {
                                $divide: [
                                    "$distanceMeters",
                                    1000
                                ]
                            },
                            3
                        ]
                    }
                }
            },
        ]);

        const hasMore = results.length > pageSize;

        const lastItem = hasMore
            ? results[pageSize - 1]
            : results[results.length - 1];

        const nextCursor = lastItem
            ? Buffer.from(JSON.stringify({
                distanceMeters: lastItem.distanceMeters,
                id: String(lastItem._id)
            })).toString("base64url")
            : null;

        const products = results
            .slice(0, pageSize)
            .map(({ distanceMeters, ...product }) => product);

        return res.json({
            success: true,
            count: products.length,
            totalNearby: null,
            page,
            pageSize,
            hasMore,
            nextCursor,
            radiusKm,
            products
        });

    } catch (error) {
        console.error(
            "Nearby Product Geo Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Nearby product search ব্যর্থ হয়েছে।"
        });
    }
});

app.get("/api/products", async (req, res) => {
    try {
        const products = await Product.find({
            status: "published"
        })
        .populate(
            "owner",
            "name phone"
        )
        .sort({
            createdAt: -1
        });

        return res.json({
            success: true,
            products
        });

    } catch (error) {
        console.log("❌ Products Load Error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Product পাওয়া যায়নি।"
        });
    }
});


// ==================================================
// V1 - MY SERVICES
// ==================================================

app.get("/api/services/my", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Login required."
            });
        }

        const services =
            await Service.find({
                owner: req.session.userId
            })
            .sort({
                createdAt: -1
            });

        return res.json({
            success: true,
            services
        });

    } catch (error) {
        console.log(
            "❌ My Services Error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message:
                "Service পাওয়া যায়নি।"
        });
    }
});


// ==================================================
// V1 - PUBLISHED SERVICES
// ==================================================

app.get("/api/services", async (req, res) => {
    try {
        const services =
            await Service.find({
                status: "published"
            })
            .populate(
                "owner",
                "name phone"
            )
            .sort({
                createdAt: -1
            });

        return res.json({
            success: true,
            services
        });

    } catch (error) {
        console.log(
            "❌ Services Load Error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message:
                "Service পাওয়া যায়নি।"
        });
    }
});


// ==================================================
// SMART SEARCH - PRODUCT + SERVICE
// ==================================================

function normalizeSearchText(value) {
    return String(value || "")
        .toLowerCase()
        .normalize("NFKC")
        .replace(/[অ-৹]/g, ch => ch)
        .replace(/[^a-z0-9\\u0980-\\u09ff]+/g, " ")
        .replace(/\\s+/g, " ")
        .trim();
}

function searchAliases(value) {
    const q = normalizeSearchText(value);
    const aliases = new Set([q]);

    const map = {
        "পয়োজন": "প্রয়োজন",
        "পয়জন": "প্রয়োজন",
        "প্রয়জন": "প্রয়োজন",
        "প্রয়জোন": "প্রয়োজন",
        "poyjon": "proyojon",
        "projon": "proyojon",
        "proyojon x": "proyojonx",
        "projon x": "proyojonx",
        "poyjon x": "proyojonx"
    };

    if(map[q]) aliases.add(map[q]);

    return [...aliases];
}

function fuzzyScore(query, text) {
    const q = normalizeSearchText(query);
    const t = normalizeSearchText(text);

    if(!q || !t) return 0;
    if(t === q) return 100;
    if(t.includes(q)) return 90;

    const words = t.split(" ");
    let best = 0;

    for(const word of words){
        if(word.includes(q) || q.includes(word)) best = Math.max(best, 75);

        const maxLen = Math.max(word.length, q.length);
        let same = 0;

        for(let i=0;i<Math.min(word.length,q.length);i++){
            if(word[i] === q[i]) same++;
        }

        if(maxLen > 0){
            best = Math.max(best, Math.round((same/maxLen)*70));
        }
    }

    return best;
}

app.get("/api/search", async (req, res) => {
    try {
        const rawQuery = String(req.query.q || "").trim();

        if(!rawQuery){
            return res.json({
                success: true,
                query: "",
                products: [],
                services: []
            });
        }

        const aliases = searchAliases(rawQuery);

        const products = await Product.find({
            status: "published"
        }).populate("owner", "name phone");

        const services = await Service.find({
            status: "published"
        }).populate("owner", "name phone");

        const productResults = products
            .map(item => {
                const text = [
                    item.name,
                    item.description,
                    item.category,
                    item.district,
                    item.upazila,
                    item.union,
                    item.village
                ].join(" ");

                const score = Math.max(
                    ...aliases.map(a => fuzzyScore(a, text))
                );

                return { item, score };
            })
            .filter(x => x.score >= 35)
            .sort((a,b) => b.score - a.score)
            .map(x => x.item);

        const serviceResults = services
            .map(item => {
                const text = [
                    item.name,
                    item.description,
                    item.category,
                    item.district,
                    item.upazila,
                    item.union,
                    item.village
                ].join(" ");

                const score = Math.max(
                    ...aliases.map(a => fuzzyScore(a, text))
                );

                return { item, score };
            })
            .filter(x => x.score >= 35)
            .sort((a,b) => b.score - a.score)
            .map(x => x.item);

        return res.json({
            success: true,
            query: rawQuery,
            products: productResults,
            services: serviceResults
        });

    } catch(error) {
        console.log("❌ Smart Search Error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Search করা যায়নি।"
        });
    }
});


// ==================================================
// EXPRESS FINAL ERROR HANDLER
// ==================================================

app.use((error, req, res, next) => {

    console.error(
        "❌ Express Error:",
        error && error.message
            ? error.message
            : "Unknown error"
    );

    if (res.headersSent) {
        return next(error);
    }

    res.status(500).json({
        success: false,
        message: "Server-এ একটি সমস্যা হয়েছে। পরে আবার চেষ্টা করুন।"
    });
});


// ==================================================
// SERVER START
// ==================================================

const PORT =
    process.env.PORT ||
    5000;
