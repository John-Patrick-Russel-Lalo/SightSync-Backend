
import express from "express";
import { deleteUserById, updateUserById } from "./users.model.js";



export async function deleteUser(req, res) {
  try {
    const userId = req.params.id;

    await deleteUserById(userId);

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
}


export async function updateUser(req, res) {
    try {
        const { id } = req.params;
        const updates = req.body;

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                message: "No fields to update"
            });
        }

        await updateUserById(id, updates);

        res.status(200).json({
            message: "User updated successfully"
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Internal server error"
        });
    }
}

export default { deleteUser, updateUser };

