const express = require("express");
const Tender = require("../models/tender");
const wrapAsync = require("../utils/wrapAsync");
const path = require("path");
const fs = require("fs");
const router = express.Router({ mergeParams: true });
const { jwtAuthenticate, planCheck } = require("../middleware");

// Constants for pagination
const DEFAULT_LIMIT = 10;

// Load JSON data containing states, districts, and departments
const dataFilePath = path.join(__dirname, "../current.json");
let statesAndDistricts = JSON.parse(fs.readFileSync(dataFilePath, "utf8"));

// Render the main tenders page (with form)
router.get(
  "/",
  jwtAuthenticate,
  wrapAsync(async (req, res) => {
    res.render("tenders/main");
  })
);

router.get("/file", jwtAuthenticate, (req, res) => {
  res.send("Filing Kar dunga bhai");
});

// Route to fetch all states
router.get(
  "/states",
  wrapAsync(async (req, res) => {
    const states = statesAndDistricts.states.map((s) => s.state);
    res.json({ states });
  })
);

// Route to fetch districts for a selected state
router.get(
  "/districts/:state",
  wrapAsync(async (req, res) => {
    const { state } = req.params;
    const stateData = statesAndDistricts.states.find((s) => s.state === state);
    if (stateData) {
      res.json({ districts: stateData.districts });
    } else {
      res.status(404).json({ error: "State not found" });
    }
  })
);

// Route to fetch departments for a selected state
router.get(
  "/departments/:state",
  wrapAsync(async (req, res) => {
    const { state } = req.params;

    // Find the state in the JSON file
    const stateData = statesAndDistricts.states.find((s) => s.state === state);

    if (stateData && stateData.departments) {
      // Return the common departments for the entire state
      res.json({ departments: stateData.departments });
    } else {
      res
        .status(404)
        .json({ error: "State not found or no departments available" });
    }
  })
);

// Handle form submission and render tenders with pagination
// Handle form submission and render tenders with pagination
router.get(
  "/list",
  jwtAuthenticate,

  wrapAsync(async (req, res) => {
    const {
      state,
      district,
      department,
      page = 1,
      limit = DEFAULT_LIMIT,
    } = req.query;

    const pageNumber = Math.max(parseInt(page, 10), 1);
    const limitNumber = Math.max(parseInt(limit, 10), 1);

    const query = {
      state,
      district: district,
      org_name: department,
      expired: false, // Only show active tenders
    };

    Object.keys(query).forEach(
      (key) => query[key] === undefined && delete query[key]
    );

    const tenders = await Tender.aggregate([
      { $match: query },
      {
        $addFields: {
          priceNumeric: {
            $convert: {
              input: {
                $replaceAll: { input: "$price", find: ",", replacement: "" },
              },
              to: "double",
              onError: null,
              onNull: null,
            },
          },
        },
      },
      { $sort: { priceNumeric: -1 } },
      { $skip: (pageNumber - 1) * limitNumber },
      { $limit: limitNumber },
      { $project: { priceNumeric: 0 } },
    ]);

    const totalTenders = await Tender.countDocuments(query);
    const totalPages = Math.ceil(totalTenders / limitNumber);

    if (tenders.length === 0 && pageNumber > 1) {
      return res.redirect(
        `/tenders/list?state=${state}&department=${department}&page=${
          pageNumber - 1
        }&limit=${limitNumber}`
      );
    }

    res.render("tenders/index", {
      tenders,
      state,
      district,
      department,
      page: pageNumber,
      totalPages,
      totalTenders,
      limit: limitNumber,
    });
  })
);

// Route to render details of a specific tender
router.get(
  "/:id",
  jwtAuthenticate,

  wrapAsync(async (req, res) => {
    try {
      const { id } = req.params;
      const tender = await Tender.findById(id);
      if (!tender) {
        return res.redirect("/tenders");
      }
      res.render("tenders/show", { tender });
    } catch (error) {
      return res.redirect("/tenders");
    }
  })
);

module.exports = router;
