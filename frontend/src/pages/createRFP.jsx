import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    Box,
    Button,
    TextField,
    Typography,
    Stack,
    Paper,
    Avatar,
    CircularProgress,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import SmartToyIcon from "@mui/icons-material/SmartToy"; // Icon for AI
import Computer from "@mui/icons-material/Computer";

export default function CreateRFP() {
    const navigate = useNavigate();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const messagesEndRef = useRef(null);
    const [pendingRfp, setPendingRfp] = useState(null);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [vendors, setVendors] = useState([]);
    const [selectedVendors, setSelectedVendors] = useState([]);
    const [showVendorSelection, setShowVendorSelection] = useState(false);
    const [lastRfpId, setLastRfpId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);


    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) {
            setError("Please enter a message.");
            return;
        }

        const userMessage = input;
        setMessages(prev => [...prev, { role: "user", content: userMessage }]);
        setInput("");
        setLoading(true);
        setError(null);
        setMessages(prev => [...prev, { role: "assistant", content: "..." }]);

        try {
            const res = await fetch("http://localhost:5000/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: userMessage }),
            });

            if (!res.ok) {
                throw new Error(`Server error: ${res.status}`);
            }

            const data = await res.json();

            if (data.error) {
                throw new Error(data.error);
            }

            if (data.structured_requirements) {
                // Validate required fields
                if (!data.structured_requirements.title) {
                    throw new Error("Invalid RFP structure: missing title");
                }

                // Save the RFP for confirmation
                setPendingRfp(data.structured_requirements);
                setShowConfirmation(true);

                const formatted = `
Title: ${data.structured_requirements.title}
Summary: ${data.structured_requirements.summary}
Requirements:
${data.structured_requirements.requirements
                        .map(r => `• ${r.item}: ${r.quantity}, ${r.specifications}`)
                        .join('\n')}
Budget: ${data.structured_requirements.budget}
Delivery: ${data.structured_requirements.delivery_terms}
Warranty: ${data.structured_requirements.warranty_terms}
Payment: ${data.structured_requirements.payment_terms}
Submission: ${data.structured_requirements.submission_instructions}
            `;
                setMessages(prev => [...prev.slice(0, -1), { role: "assistant", content: formatted }]);
            } else {
                // Plain text response
                setMessages(prev => [...prev.slice(0, -1), { role: "assistant", content: data.reply }]);
            }
        } catch (err) {
            const errorMessage = err.message || "Error contacting backend. Please try again.";
            setError(errorMessage);
            setMessages(prev => [...prev.slice(0, -1), { role: "assistant", content: `Error: ${errorMessage}` }]);
        } finally {
            setLoading(false);
        }
    };

    const fetchVendors = async () => {
        const res = await fetch("http://localhost:5000/api/rfps/vendors");
        const data = await res.json();
        setVendors(data.vendors);
    };


    const handleRfpConfirmation = async (approved) => {
        if (!approved) {
            setMessages(prev => [
                ...prev,
                { role: "assistant", content: "RFP discarded. You can submit a new one." }
            ]);
            setPendingRfp(null);
            setShowConfirmation(false);
            return;
        }

        // If approved — fetch vendors & show selector
        await fetchVendors();
        setShowVendorSelection(true);
        setShowConfirmation(false); // hide the first buttons
    };

    const toggleVendor = (id) => {
        setSelectedVendors(prev =>
            prev.includes(id)
                ? prev.filter(v => v !== id)
                : [...prev, id]
        );
    };

    const handleSendToVendors = async () => {
        if (selectedVendors.length === 0) {
            setError("Please select at least one vendor.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const res = await fetch("http://localhost:5000/api/rfps/confirm", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    approved: true,
                    rfp: pendingRfp,
                    vendorIds: selectedVendors
                })
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || `Server error: ${res.status}`);
            }

            const data = await res.json();

            if (data.error) {
                throw new Error(data.error);
            }

            setMessages(prev => [
                ...prev,
                { role: "assistant", content: `RFP saved and sent to ${data.vendorsLinked || selectedVendors.length} vendor(s)!` }
            ]);

            if (data.rfp?.id) {
                setLastRfpId(data.rfp.id);
            }

            // Clear chat messages after successful RFP creation
            setMessages([]);
        } catch (err) {
            const errorMessage = err.message || "Error sending RFP to vendors. Please try again.";
            setError(errorMessage);
            setMessages(prev => [
                ...prev,
                { role: "assistant", content: `Error: ${errorMessage}` }
            ]);
        } finally {
            setLoading(false);
            setPendingRfp(null);
            setShowVendorSelection(false);
            setSelectedVendors([]);
        }
    };



    return (
        <Box
            sx={{
                width: "100%",
                height: "100vh",
                display: "flex",
                flexDirection: "column",
                bgcolor: "#121212",
                color: "white",
                overflow: "hidden",
            }}
        >
            {/* Main Container - Full width */}
            <Box
                sx={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    bgcolor: "#121212",
                }}
            >
                {/* 1. Header */}
                <Box
                    sx={{
                        width: "100%",
                        p: 2,
                        bgcolor: "#121212",
                        borderBottom: "1px solid #333",
                        display: "flex",
                        justifyContent: "center",
                        position: "relative",
                    }}
                >
                    <Typography variant="h6" fontWeight={600}>
                        RFP Generator
                    </Typography>
                    {messages.length > 0 && (
                        <Button
                            onClick={() => {
                                setMessages([]);
                                setPendingRfp(null);
                                setLastRfpId(null);
                                setShowConfirmation(false);
                                setShowVendorSelection(false);
                                setSelectedVendors([]);
                            }}
                            sx={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', color: 'grey.500', minWidth: 0, p: 0 }}
                        >
                            Clear Chat
                        </Button>
                    )}
                </Box>

                {/* 2. Chat Area */}
                <Box
                    sx={{
                        flexGrow: 1,
                        width: "100%",
                        overflowY: "auto",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: messages.length === 0 ? "center" : "flex-start",
                        py: 4,
                    }}
                >
                    {/* Content Box */}
                    <Box sx={{ width: '100%', maxWidth: "1200px", px: { xs: 1, sm: 2 } }}>

                        {/* Empty State */}
                        {messages.length === 0 && (
                            <Box
                                sx={{
                                    height: "100%",
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    opacity: 0.8,
                                }}
                            >
                                <Computer sx={{ fontSize: 60, mb: 2 }} />
                                <Typography variant="h8" fontWeight={100} gutterBottom>
                                    How can I help you today?
                                </Typography>
                            </Box>
                        )}

                        {/* Message List */}
                        <Stack spacing={3}>
                            {messages.map((msg, index) => (
                                <Box
                                    key={index}
                                    sx={{
                                        display: "flex",
                                        gap: 2,
                                        justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                                    }}
                                >
                                    {/* AI Icon */}
                                    {msg.role === "assistant" && (
                                        <Avatar sx={{ bgcolor: "#19c37d", width: 32, height: 32 }}>
                                            <SmartToyIcon sx={{ fontSize: 20 }} />
                                        </Avatar>
                                    )}

                                    <Paper
                                        elevation={0}
                                        sx={{
                                            p: 2.5,
                                            maxWidth: "80%",
                                            borderRadius: "16px",
                                            // User bubble is distinct blue, AI bubble is subtle dark grey
                                            bgcolor: msg.role === "user" ? "#3f51b5" : "#2C2C2C",
                                            color: "white",
                                            // Shape the bubble corners
                                            borderTopRightRadius: msg.role === "user" ? 0 : "16px",
                                            borderTopLeftRadius: msg.role === "assistant" ? 0 : "16px",
                                        }}
                                    >
                                        <Typography variant="body1" sx={{ lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                                            {msg.content}
                                        </Typography>
                                    </Paper>
                                </Box>
                            ))}
                            <div ref={messagesEndRef} />
                        </Stack>
                        {showConfirmation && (
                            <Box sx={{ display: "flex", justifyContent: "center", gap: 2, mt: 3 }}>
                                <Button variant="contained" color="success" onClick={() => handleRfpConfirmation(true)}>
                                    Yes, proceed
                                </Button>

                                <Button variant="contained" color="error" onClick={() => handleRfpConfirmation(false)}>
                                    No, I'll submit a new one
                                </Button>
                            </Box>
                        )}

                        {/* Vendor Selection UI */}
                        {showVendorSelection && (
                            <Box sx={{ mt: 3, p: 3, bgcolor: "#1a1a1a", borderRadius: "12px" }}>
                                <Typography variant="h6" sx={{ mb: 2 }}>
                                    Select vendors to send this RFP to:
                                </Typography>

                                <Stack spacing={1}>
                                    {vendors.map(v => (
                                        <label key={v.id} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                            <input
                                                type="checkbox"
                                                checked={selectedVendors.includes(v.id)}
                                                onChange={() => toggleVendor(v.id)}
                                            />
                                            <Typography>
                                                {v.vendor_name} ({v.contact_name}) — {v.contact_email}
                                            </Typography>
                                        </label>
                                    ))}
                                </Stack>

                                <Button
                                    variant="contained"
                                    color="success"
                                    sx={{ mt: 2 }}
                                    onClick={handleSendToVendors}
                                >
                                    Send RFP to Selected Vendors
                                </Button>
                            </Box>
                        )}

                        {/* Success / Navigation */}
                        {lastRfpId && (
                            <Box sx={{ mt: 3, textAlign: "center" }}>
                                <Button
                                    variant="contained"
                                    size="large"
                                    onClick={() => navigate(`/compare/${lastRfpId}`)}
                                    sx={{ bgcolor: "#19c37d", "&:hover": { bgcolor: "#15a067" } }}
                                >
                                    View Proposals & Comparison in Real-time
                                </Button>
                                <Button
                                    variant="text"
                                    sx={{ display: 'block', mx: 'auto', mt: 1, color: 'grey.500' }}
                                    onClick={() => {
                                        setLastRfpId(null);
                                        setMessages([]);
                                        setPendingRfp(null);
                                        setShowConfirmation(false);
                                        setShowVendorSelection(false);
                                        setSelectedVendors([]);
                                        setInput("");
                                    }}
                                >
                                    Start New RFP
                                </Button>
                            </Box>
                        )}
                    </Box>
                </Box>

                {/* 3. Input Area */}
                <Box
                    sx={{
                        // Removed width: "100%" to avoid overflow with padding
                        bgcolor: "#1E1E1E",
                        p: 3,
                        display: "flex",
                        justifyContent: "flex-start",
                    }}
                >
                    <Box sx={{ width: '100%', maxWidth: "1200px" }}>
                        <Paper
                            component="form"
                            elevation={6}
                            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                            sx={{
                                p: "8px",
                                display: "flex",
                                alignItems: "center",
                                bgcolor: "#2f2f2f",
                                borderRadius: "16px",
                                border: "1px solid #444",
                            }}
                        >
                            <TextField
                                fullWidth
                                multiline
                                maxRows={4}
                                placeholder="Send a message..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                                variant="standard"
                                InputProps={{
                                    disableUnderline: true,
                                    sx: { color: "white", pl: 2, fontSize: "1rem" }
                                }}
                            />
                            <Button
                                type="submit"
                                disabled={!input.trim() || loading}
                                sx={{
                                    minWidth: "40px",
                                    color: "white",
                                    bgcolor: input.trim() && !loading ? "#19c37d" : "#444",
                                    borderRadius: "10px",
                                    p: 1.5,
                                    ml: 1,
                                    "&:hover": { bgcolor: input.trim() && !loading ? "#15a067" : "#444" }
                                }}
                            >
                                {loading ? (
                                    <CircularProgress size={20} sx={{ color: "white" }} />
                                ) : (
                                    <SendIcon fontSize="small" />
                                )}
                            </Button>
                        </Paper>
                        <Typography variant="caption" display="block" textAlign="center" sx={{ mt: 1.5, color: "grey.500" }}>
                            AI can make mistakes. Consider checking important information.
                        </Typography>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}