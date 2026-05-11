const { StatusCodes } = require("http-status-codes");
const { userSchema } = require("../validation/userSchema");
const prisma = require("../db/prisma");
//const pool = require("../db/pg-pool");
const crypto = require("crypto");
const util = require("util");
const scrypt = util.promisify(crypto.scrypt);
//Hashing functions
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = await scrypt(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

async function comparePassword(inputPassword, storedHash) {
  const [salt, key] = storedHash.split(":");
  const keyBuffer = Buffer.from(key, "hex");
  const derivedKey = await scrypt(inputPassword, salt, 64);
  return crypto.timingSafeEqual(keyBuffer, derivedKey);
}

//function register which pushes the name of the newUser information onto the array newUser
const register = async (req, res, next) => {
  if (!req.body) req.body = {};
  const { error, value } = userSchema.validate(req.body, { abortEarly: false });
  if (error) {
    //return 400 if validation fails
    return res.status(StatusCodes.BAD_REQUEST).json({ message: error.message });
  }
  //3. Check if user exists already using cleaned 'value.email')
  let user = null;
  value.hashedPassword = await hashPassword(value.password);
  delete value.password;
  // the code to here is like the in-memory version
  try {
    user = await prisma.user.create({
      data: value, // this uses name, email, and hashedPassword from 'value'
      select: { name: true, email: true, id: true },
    });
    // 6. Success! (The 'user' variable is accessible here because of 'let user = null')
    global.user_id = user.id;
    res.status(StatusCodes.CREATED).json({
      name: user.name,
      email: user.email,
    });
  } catch (err) {
    // 5. Handle the Prisma-specific error code for "Unique constraint"
    if (err.name === "PrismaClientKnownRequestError" && err.code === "P2002") {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: "User already exists" });
    }
    return next(err);
  }

  
};
/*
    user = await pool.query(
      `INSERT INTO users (email, name, hashed_password) 
      VALUES ($1, $2, $3) RETURNING id, email, name`,
      [value.email, value.name, value.hashed_password],
    );
    const newUser = user.rows[0];
    global.user_id = newUser.id;
    //lesson 5B instructions say in register function to return a body with only name and email
    res
      .status(StatusCodes.CREATED)
      .json({ name: newUser.name, email: newUser.email });
    // note that you use a parameterized query
  } catch (e) {
    // the email might already be registered
    if (e.code === "23505") {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: "User already exists" });
      // this means the unique constraint for email was violated
    }
    return next(e); // all other errors get passed to the error handler
  }
};*/

/*in Lesson 5b we remove using a loop function to find if the user is existing 
  //4. For validate section use value to create the user replace req.body with value

  //const newUser = { ...value }; // this makes a copy
  const newUser = {
    name: value.name,
    email: value.email,
    password: hashedPassword, //store hashed pwd not plain text pwd
  };
 */

const logon = async (req, res, next) => {
  const { email, password } = req.body;
  const lowCaseEmail = email?.toLowerCase();
  try {
    const user = await prisma.user.findUnique({
      where: { email: lowCaseEmail },
    });
    if (!user) {
      return res
        .status(StatusCodes.UNAUTHORIZED)
        .json({ message: "Authentication Failed" });
    }
    const isMatched = await comparePassword(password, user.hashedPassword);

    if (isMatched) {
      global.user_id = user.id;
      res.status(StatusCodes.OK).json({ name: user.name, email: user.email });
    } else {
      res
        .status(StatusCodes.UNAUTHORIZED)
        .json({ message: "Authentication Failed." });
    }
  } catch (e) {
    return next(e);
  }
};

const logoff = (req, res) => {
  global.user_id = null;
  res.sendStatus(StatusCodes.OK);
};
module.exports = { register, logon, logoff };
