import { Outlet } from "react-router-dom";
import { Box } from "@mui/material";
import Sidebar from "./Sidebar";

export default function Layout() {
    return (
        <Box sx={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden", bgcolor: "#121212" }}>
            <Sidebar />
            <Box sx={{ flexGrow: 1, height: "100vh", overflow: "auto", position: "relative" }}>
                <Outlet />
            </Box>
        </Box>
    );
}
