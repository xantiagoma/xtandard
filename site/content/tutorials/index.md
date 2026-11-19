---
title: "Tutorials"
description: "Step-by-step tutorials that build something real with xtandard: a filterable paginated list, a streaming UI, and booking availability with intervals."
---

Each tutorial builds one small, working feature from start to finish. Every step adds code to the
previous one, and the last section shows the finished result. They are meant to be followed in order.
For a reference to every option of a module, see its guide pages instead.

You need TypeScript and some familiarity with the libraries each tutorial uses (named below). Install
commands are at the top of each page.

## [A filterable, paginated list](@BASE@/tutorials/filterable-list/)

Build a "products" list with filters, sorting and cursor pagination. All of that state lives in the
URL, from the database query to the address bar.

You will learn how to:

- share one field allow-list and URL format between the browser and the server;
- validate a filter request with the valibot schemas and render it to a Drizzle `WHERE`, and switch to
  Kysely or Prisma;
- page through results with keyset pagination (`createDrizzleKeyset` + `createPaginator`), including
  previous pages;
- serve a REST endpoint that answers 400 for a tampered cursor;
- keep filters, sort and cursor in the URL with `@xtandard/lib/tanstack` and the compact filter
  encoding.

Uses: Drizzle, valibot, TanStack Router, TanStack Query.

## [Streaming results into the UI](@BASE@/tutorials/streaming-ui/)

Show supplier quotes as they arrive, in a list and in a toast, instead of waiting for all of them.

You will learn how to:

- write a producer as an async generator, or as an `AsyncChannel` fed by concurrent requests;
- render a stream with `useStream` and `StreamRenderer`, including its return value and error state;
- keep only what you need with `mode`, `maxItems` or a `reducer`;
- track the same work in a Sonner toast with `toastStream` and `toastStreamAsync`;
- fake a producer with `asyncOf` while you build and test the UI.

Uses: React, TanStack Query, Sonner.

## [Availability with intervals](@BASE@/tutorials/booking-ranges/)

Model a meeting room's bookings as time ranges and find out when it is free.

You will learn how to:

- represent bookings as half-open `InstantInterval`s, so back-to-back meetings don't conflict;
- detect conflicts with `overlaps` and `intersection`;
- merge busy time with `mergeIntervals` and compute free slots with `difference`;
- find a slot that fits a meeting with `length` and `fromStart`;
- classify room rates into price bands with money intervals from `@xtandard/lib/dinero`, and check
  that the bands leave no gaps.

Uses: `@js-temporal/polyfill`, dinero.js.
