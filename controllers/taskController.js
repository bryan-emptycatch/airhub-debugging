//Closure should be defined before the functions that use it
const { StatusCodes } = require("http-status-codes");
const { taskSchema, patchTaskSchema } = require("../validation/taskSchema");
const prisma = require("../db/prisma");
//need create
const create = async (req, res, next) => {
  if (!req.body) req.body = {};
  const { error, value } = taskSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(StatusCodes.BAD_REQUEST).json({ message: error.message });
  }
  try {
    //Lesson 6: prisma.task.create
    const newTask = await prisma.task.create({
      data: {
        title: value.title,
        isCompleted: value.isCompleted ?? false,
        userId: global.user_id,
      },
      //which columns to return which is the body of the response and make sure just like lesson 5 userId is not sent back in the response
      select: {
        id: true,
        title: true,
        isCompleted: true,
      },
    });
    res.status(StatusCodes.CREATED).json(newTask);
  } catch (err) {
    return next(err);
  }
}; /*
  const result = await pool.query(
    `INSERT INTO tasks (title, is_completed, user_id) 
  VALUES ( $1, $2, $3 ) RETURNING id, title, is_completed`,
    //AI review recommended adding ?? false in case JOI doesn't provide a value to act as a default
    [value.title, value.is_completed ?? false, global.user_id],
  );

  const newTask = result.rows[0]; // we do this because we can only add one task at a time
  res.status(StatusCodes.CREATED).json(newTask);
};*/
//index GET /api/tasks
const index = async (req, res) => {
  const tasks = await prisma.task.findMany({
    where: {
      userId: global.user_id,
    },
    select: { title: true, isCompleted: true, id: true },
  });
  if (tasks.length === 0) {
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ message: "No tasks found" });
  }
  res.status(StatusCodes.OK).json(tasks);
};

/*
  const result = await pool.query(
    "SELECT id, title, is_completed FROM tasks WHERE user_id = $1",
    [global.user_id],
  );
 if (result.rows.length === 0) {
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ message: "No tasks found" });
  }
  res.status(StatusCodes.OK).json(result.rows);
};
*/
//need show GET /api/task/:id
const show = async (req, res, next) => {
  const taskToFind = parseInt(req.params?.id);
  if (isNaN(taskToFind)) {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ message: "That task ID is invalid" });
  }
  try {
    const task = await prisma.task.findUnique({
      where: {
        id_userId: { id: taskToFind, userId: global.user_id },
      },
      select: { id: true, title: true, isCompleted: true },
    });
    if (!task) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ message: "Task was not found" });
    }
    res.status(StatusCodes.OK).json(task);
  } catch (err) {
    if (err.code === "P2025") {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ message: "Task was not found" });
    }
    //pass other unexpected errors to global error handler
    return next(err);
  }
};
/*const result = await pool.query(
    "SELECT id, title, is_completed FROM tasks WHERE id = $1 AND user_id = $2",
    [taskToFind, global.user_id],
  );
  if (result.rows.length === 0) {
    return res.status(StatusCodes.NOT_FOUND).json({
      message: "Task was not found",
    });
  }
  res.status(StatusCodes.OK).json(result.rows[0]);
};*/
//need update
const update = async (req, res, next) => {
  if (!req.body) req.body = {};
  const taskToFind = parseInt(req.params?.id);
  //we get the index, not the task, so that we can splice it out
  if (isNaN(taskToFind)) {
    //if task doesn't exist
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ message: "Invalid Task ID" });
  }
  //validate using patchTaskSchema
  const { error, value } = patchTaskSchema.validate(req.body, {
    abortEarly: false,
  });
  if (error) {
    return res.status(StatusCodes.BAD_REQUEST).json({ message: error.message });
  }
  //Object. assign using Hint 2
  //for Lesson4 validation section replace req.body to value
  //5B replace taskChange with value which is initial variable in patchSchema
  /*let keys = Object.keys(value);
  if (keys.length === 0) {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ message: "No information provided for update " });
  }
  const columnNames = keys.map((key) =>
    key === "isCompleted" ? "is_completed" : key,
  );
  const setClauses = columnNames
    .map((col, i) => `${col} = $${i + 1}`)
    .join(", ");
  const idParm = `$${keys.length + 1}`;
  const userParm = `$${keys.length + 2}`;
*/
  try {
    const task = await prisma.task.update({
      data: value,
      where: {
        id_userId: {
          id: taskToFind,
          userId: global.user_id,
        },
      },
      select: { title: true, isCompleted: true, id: true },
    });
    res.status(StatusCodes.OK).json(task);

    /*`UPDATE tasks SET ${setClauses} 
  WHERE id = ${idParm} AND user_id = ${userParm} RETURNING id, title, is_completed`,
      [...Object.values(value), taskToFind, global.user_id],
    );
    if (result.rows.length === 0) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ message: "Task not found" });
    }
    res.status(StatusCodes.OK).json(result.rows[0]);*/
  } catch (err) {
    if (err.code === "P2025") {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ message: "The task was not found." });
    } else {
      return next(err); // pass other errors to the global error handler
    }
  }
};
//need deleteTask using apt/tasks/:id
const deleteTask = async (req, res, next) => {
  const taskToFind = parseInt(req.params?.id); //if there are no params, the ? makes sure that you get a null

  if (!taskToFind) {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ message: "The task ID passed is not valid." });
  }
  try {
    const task = await prisma.task.delete({
      where: {
        id_userId: {
          id: taskToFind,
          userId: global.user_id,
        },
      },
      select: { title: true, isCompleted: true, id: true },
    });
    res.status(StatusCodes.OK).json(task);
  } catch (err) {
    if (err.code === "P2025") {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ message: "The task was not found." });
    } else {
      return next(err); // pass other errors to the global error handler
    }
  }
};
module.exports = { create, index, show, update, deleteTask };
/*const result = await pool.query(
    "DELETE FROM tasks WHERE id =$1 AND user_id = $2 RETURNING id, title, is_completed",
    [taskToFind, global.user_id],
  );
  //we get the index, not the task, so that we can splice it out
  if (result.rows.length === 0) {
    //if task doesn't exist
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ message: "That task was not found" });
  }
  res.status(StatusCodes.OK).json(result.rows[0]);
};*/
