let currentRecordId, triggeredByUser, module_name, func_name, form_type, application_id, application_type, application_stage = null;
let isValidForResend = false;
let validationMessage = "";

const SELECTORS = {
  popup: "popup",
  popupTitle: "popupTitle",
  popupMessage: "popupMessage",
};

ZOHO.embeddedApp.on("PageLoad", async (e) => { 
    if(e && e.EntityId){
        currentRecordId = e.EntityId[0]; 
        module_name = e.Entity;
    }

    console.log(module_name);
    if(module_name === "New_License_Forms") {
        const record_response = await ZOHO.CRM.API.getRecord({ Entity: module_name, approved: "both", RecordID: currentRecordId,});
        const record_data = record_response.data[0];

        application_id = record_data.New_License_Application.id;
    } else {
        const record_response = await ZOHO.CRM.API.getRecord({ Entity: module_name, approved: "both", RecordID: currentRecordId,});
        const record_data = record_response.data[0];

        application_id = record_data.Application_No.id;
    }

    const application_rseponse = await ZOHO.CRM.API.getRecord({ Entity: "Applications1", approved: "both", RecordID: application_id,});
    const application_data = application_rseponse.data[0];
    application_type = application_data.Type;
    application_stage = application_data.New_Resident_Visa_Stage;

    if (application_type === "New Trade License" || application_type === "Pre-Approval") {
        if (application_stage === "KYB and KYC Forms Sent" || application_stage === "Submitted to Authority") {
            isValidForResend = true;
        } else {
            validationMessage = "Resend is only allowed when Application Stage is 'KYB and KYC Forms Sent' or 'Submitted to Authority'.";
        }
    }
    else if (application_type === "Renewal Trade License" || application_type === "Amendment Trade License") {
        if (application_stage === "Docs Sent for Signing" || application_stage === "Submitted to Authority") {
            isValidForResend = true;
        } else {
            validationMessage = "Resend is only allowed when Application Stage is 'Docs Sent for Signing' or 'Submitted to Authority'.";
        }
    }
    else {
        validationMessage = "This Application Type is not allowed for resending forms.";
    }


    const userInfo = await ZOHO.CRM.CONFIG.getCurrentUser();
    triggeredByUser = userInfo.users[0].full_name;
    console.log("Triggered by:", triggeredByUser);

     ZOHO.CRM.UI.Resize({ height: "30%" }).then(function (data) {
      console.log("Resize result:", data);
     });
});

function showPopup(message, type = "restricted") {
  const popup = document.getElementById(SELECTORS.popup);
  popup.classList.remove("hidden");
  popup.classList.toggle("success", type === "success");
  popup.classList.toggle("restricted", type !== "success");
  document.getElementById(SELECTORS.popupTitle).textContent = "Action Status";
  document.getElementById(SELECTORS.popupMessage).innerHTML = message;
}

function hidePopup() {
    const popup = document.getElementById("popup");
    popup.classList.add("hidden");
    popup.classList.remove("success", "restricted");
    ZOHO.CRM.UI.Popup.closeReload().then(console.log)
}

async function resend_kyb_kyc(event) {
    event.preventDefault();

    const reasonInput = document.getElementById("reason");
    const reason_for_resending = reasonInput.value.trim();
    const errorSpan = document.getElementById("reason-error");
    const loader = document.getElementById("loader-overlay");

    reasonInput.classList.remove("input-error");
    errorSpan.style.display = "none";

    if (!reason_for_resending) {
        reasonInput.classList.add("input-error");
        errorSpan.innerText = "Please provide a reason for resending.";
        errorSpan.style.display = "block";
        return;
    }

    if (!isValidForResend) {
        reasonInput.classList.add("input-error");
        errorSpan.innerHTML =`${validationMessage}`;
        errorSpan.style.display = "block";
        return;
    }


    loader.style.display = "flex";

    if(module_name === "New_License_Forms") {
        func_name = "resend_kyb_form_reason";
    } else {
        func_name = "resend_kyc_form_reason";
    }

    console.log(func_name);
    
    const req_data = {
        "arguments": JSON.stringify({
            "record_id": currentRecordId,
            "notes": reason_for_resending,
            "triggered_by": triggeredByUser
        })
    };

    try {
        const response = await ZOHO.CRM.FUNCTIONS.execute(func_name, req_data);
        console.log("Response:", response);

        if (response && response.code === "success") {
            if(module_name === "New_License_Forms") {
                showPopup("Re-Send KYB Form sucessful", "success");
            } else {
                showPopup("Re-Send KYC Form sucessful", "success");
            }
            // await ZOHO.CRM.UI.Popup.closeReload().then(console.log);
        } else {
            throw new Error("Function returned an error: " + response.code);
        }
    } catch (error) {
        console.error("Error:", error);
        loader.style.display = "none";
        alert("Execution failed. Please check your connection.");
    }
}

document.getElementById("record-form").addEventListener("submit", resend_kyb_kyc);

ZOHO.embeddedApp.init();