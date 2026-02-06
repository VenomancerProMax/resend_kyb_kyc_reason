let currentRecordId, triggeredByUser, module_name, func_name, application_type, application_stage = null;
let isValidForResend = false;
let validationMessage = "";

const SELECTORS = {
    popup: "popup",
    popupTitle: "popupTitle",
    popupMessage: "popupMessage",
    mainTitle: "main-title",
    loaderText: "loader-text"
};

ZOHO.embeddedApp.on("PageLoad", async function (e) {
    await initializeWidget(e);
});

ZOHO.embeddedApp.init();

async function initializeWidget(e) {
    try {
        if (e && e.EntityId) {
            currentRecordId = e.EntityId[0];
            module_name = e.Entity;
        } else {
            const pageInfo = await ZOHO.CRM.INTERACTION.getPageInfo();
            currentRecordId = pageInfo.recordId;
            module_name = pageInfo.module;
        }

        if (!currentRecordId) throw new Error("Unable to identify Record ID.");

        const titleElement = document.getElementById(SELECTORS.mainTitle);
        const loadingElement = document.getElementById(SELECTORS.loaderText);

        if (module_name === "New_License_Forms") {
            titleElement.textContent = "Resending of KYB Form";
            loadingElement.textContent = "Resending KYB Form...";
        } else {
            titleElement.textContent = "Resending of KYC Form";
            loadingElement.textContent = "Resending KYC Form...";
        }

        const record_response = await ZOHO.CRM.API.getRecord({ 
            Entity: module_name, 
            approved: "both", 
            RecordID: currentRecordId 
        });

        if (!record_response || !record_response.data) {
            throw new Error("No data returned for this record.");
        }

        const record_data = record_response.data[0];
        application_type = record_data.Application_Type;
        application_stage = record_data.Application_Stage;

        validateStage(application_type, application_stage);

        const userInfo = await ZOHO.CRM.CONFIG.getCurrentUser();
        triggeredByUser = userInfo.users[0].full_name;

        ZOHO.CRM.UI.Resize({ height: "450", width: "550" });

    } catch (err) {
        showPopup("Data Fetch Error", err.message, "restricted");
    }
}

function validateStage(type, stage) {
    if (type === "New Trade License" || type === "Pre-Approval") {
        if (["KYB and KYC Forms Sent", "Submitted to Authority"].includes(stage)) {
            isValidForResend = true;
        } else {
            validationMessage = "Resend only allowed in 'KYB and KYC Forms Sent' or 'Submitted to Authority' stages.";
        }
    } else if (type === "Renewal Trade License" || type === "Amendment Trade License") {
        if (["Docs Sent for Signing", "Submitted to Authority"].includes(stage)) {
            isValidForResend = true;
        } else {
            validationMessage = "Resend only allowed in 'Docs Sent for Signing' or 'Submitted to Authority' stages.";
        }
    } else {
        validationMessage = "This Application Type is not supported for resending.";
    }
}

function showPopup(titleText, message, type = "restricted") {
    const popup = document.getElementById(SELECTORS.popup);
    const iconDiv = document.getElementById("statusIcon");
    const title = document.getElementById(SELECTORS.popupTitle);
    const msg = document.getElementById(SELECTORS.popupMessage);
    const closeBtn = document.getElementById("closeBtn");
    
    popup.classList.remove("hidden");
    title.textContent = titleText;
    msg.innerHTML = message;
    
    if(type === "success") {
        iconDiv.className = "mx-auto flex items-center justify-center h-16 w-16 rounded-full mb-4 bg-green-50 text-green-500 ring-8 ring-green-50/50";
        iconDiv.innerHTML = '<svg class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>';
        title.className = "text-xl font-extrabold text-slate-900 mb-2";
        closeBtn.className = "w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-4 rounded-xl text-sm transition-all shadow-lg active:scale-[0.98]";
    } else {
        iconDiv.className = "mx-auto flex items-center justify-center h-16 w-16 rounded-full mb-4 bg-red-50 text-red-500 ring-8 ring-red-50/50";
        iconDiv.innerHTML = '<svg class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>';
        title.className = "text-xl font-extrabold text-slate-900 mb-2";
        closeBtn.className = "w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-xl text-sm transition-all shadow-lg active:scale-[0.98]";
    }
}

function hidePopup() {
    document.getElementById("popup").classList.add("hidden");
    ZOHO.CRM.UI.Popup.closeReload();
}

async function resend_kyb_kyc(event) {
    event.preventDefault();
    const reasonInput = document.getElementById("reason");
    const errorSpan = document.getElementById("reason-error");
    const loader = document.getElementById("loader-overlay");
    const submitBtn = event.submitter;

    if (!reasonInput.value.trim()) {
        reasonInput.classList.add("border-red-500", "ring-red-100", "ring-2");
        errorSpan.textContent = "Please provide a reason.";
        errorSpan.classList.remove("hidden");
        return;
    }

    if (!isValidForResend) {
        showPopup("Action Restricted", validationMessage, "restricted");
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Processing...";
    loader.classList.replace("hidden", "flex");
    
    func_name = (module_name === "New_License_Forms") ? "resend_kyb_form_reason" : "resend_kyc_form_reason";
   
    try {
        const response = await ZOHO.CRM.FUNCTIONS.execute(func_name, {
            "arguments": JSON.stringify({
                "record_id": currentRecordId,
                "notes": reasonInput.value.trim(),
                "triggered_by": triggeredByUser
            })
        });

        loader.classList.replace("hidden", "flex");

        if (response && (response.code === "success" || response.status === "success")) {
            const successTitle = (module_name === "New_License_Forms") ? "KYB Sent Successfully" : "KYC Sent Successfully";
            const successMsg = "The request has been processed and the form has been resent to the recipient.";
            
            showPopup(successTitle, successMsg, "success");
        } else {
            submitBtn.disabled = false;
            submitBtn.textContent = "Re-Send";
            showPopup("Request Failed", "We encountered an issue: " + (response.code || "Unknown Error"), "restricted");
        }
    } catch (error) {
        loader.classList.replace("flex", "hidden");
        submitBtn.disabled = false;
        submitBtn.textContent = "Re-Send";
        showPopup("Connection Error", "Please check your network and try again.", "restricted");
    }
}

document.getElementById("record-form").addEventListener("submit", resend_kyb_kyc);