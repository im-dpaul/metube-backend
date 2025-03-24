import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Subscription } from "../models/subscription.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Types } from "mongoose";

const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.body;
  if (!channelId) {
    throw new ApiError(400, "Channel id is required");
  }

  if (channelId === req.user?._id.toString()) {
    throw new ApiError(400, "Can not subscribe own channel");
  }

  const oldSubscription = await Subscription.findOneAndDelete({
    channel: channelId,
    subscriber: req.user?._id,
  });
  if (oldSubscription) {
    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Channel unsubscribed successfully"));
  }

  const newSubscription = await Subscription.create({
    channel: channelId,
    subscriber: req.user?._id,
  });
  if (!newSubscription) {
    throw new ApiError(500, "Something went wrong while subscribing channel");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, newSubscription, "Channel subscribed successfully")
    );
});

const getSubscribedChannels = asyncHandler(async (req, res) => {
  const user = req.user?._id;
  if (!user) {
    throw new ApiError(401, "User is not logged in");
  }

  const subscribedChannels = await Subscription.aggregate([
    {
      $match: { subscriber: new Types.ObjectId(user) },
    },
    {
      $lookup: {
        from: "users",
        localField: "channel",
        foreignField: "_id",
        as: "channel",
        pipeline: [
          {
            $lookup: {
              from: "videos",
              localField: "_id",
              foreignField: "owner",
              as: "videos",
            },
          },
          {
            $addFields: {
              videoCount: { $size: "$videos" },
            },
          },
          {
            $project: {
              _id: 1,
              username: 1,
              fullName: 1,
              avatar: 1,
              videoCount: 1,
            },
          },
        ],
      },
    },
    {
      $unwind: "$channel",
    },
    {
      $replaceRoot: { newRoot: "$channel" },
    },
  ]);

  if (subscribedChannels.length === 0) {
    throw new ApiError(400, "No channels subscribed");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        subscribedChannels,
        "Subscribed channels fetched successfully"
      )
    );
});

const getChannelSubscribers = asyncHandler(async (req, res) => {
  const user = req.user?._id;
  if (!user) {
    throw new ApiError(401, "User is not logged in");
  }

  const subscribers = await Subscription.aggregate([
    {
      $match: { channel: new Types.ObjectId(user) },
    },
    {
      $lookup: {
        from: "users",
        localField: "subscriber",
        foreignField: "_id",
        as: "subscriber",
        pipeline: [
          {
            $project: {
              username: 1,
              fullName: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $unwind: "$subscriber",
    },
    {
      $replaceRoot: {
        newRoot: "$subscriber",
      },
    },
  ]);

  if (subscribers.length === 0) {
    throw new ApiError(400, "No channel subscribers found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        subscribers,
        "Channel subscribers fetched successfully"
      )
    );
});

export { toggleSubscription, getChannelSubscribers, getSubscribedChannels };
