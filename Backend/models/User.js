import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true
    },

    password: {
      type: String,
      minlength: 8,
      select: false
    },

    avatarUrl: {
      type: String,
      default: ""
    },

    tokenVersion: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

userSchema.path("password").validate(function (value) {
  return typeof value === "string" && value.length >= 8;
}, "Password must be at least 8 characters");

// hash password before save
userSchema.pre("save", async function () {
  if (!this.password || !this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});


// compare password
userSchema.methods.comparePassword = async function (password) {
  if (!this.password) return false;
  return bcrypt.compare(password, this.password);
};

export default mongoose.model("User", userSchema);
