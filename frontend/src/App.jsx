import { Routes, Route } from "react-router-dom";

// Components
import Layout from "./components/Layout.jsx";

// Pages
import CreateRFP from "./pages/createRFP.jsx";
import Comparison from "./pages/Comparison.jsx";
import Vendors from "./pages/Vendors.jsx";
import RfpList from "./pages/RfpList.jsx";

function App() {
    return (
        <Routes>
            {/* Wrap all pages in the Sidebar Layout */}
            <Route element={<Layout />}>
                <Route path="/" element={<CreateRFP />} />
                <Route path="/rfps" element={<RfpList />} />
                <Route path="/vendors" element={<Vendors />} />
                <Route path="/compare/:id" element={<Comparison />} />
            </Route>
        </Routes>
    );
}

export default App;
