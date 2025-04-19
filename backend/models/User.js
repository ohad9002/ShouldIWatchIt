const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
  },
  { timestamps: true }
);

// Hash password before saving the user document
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    console.log("Password before hashing in pre-save middleware:", this.password);
    this.password = await bcrypt.hash(this.password, 10);
    console.log("Password after hashing in pre-save middleware:", this.password);
    next();
});

// Method to compare the password during login
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);