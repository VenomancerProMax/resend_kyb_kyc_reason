let currentRecordId, triggeredByUser, module_name, func_name = null;

ZOHO.embeddedApp.on("PageLoad", async (e) => { 
    if(e && e.EntityId){
        currentRecordId = e.EntityId[0]; 
        module_name = e.Entity;
    }

    console.log(currentRecordId);

    const userInfo = await ZOHO.CRM.CONFIG.getCurrentUser();
    triggeredByUser = userInfo.users[0].full_name;
    console.log("Triggered by:", triggeredByUser);

    ZOHO.CRM.UI.Resize({ height: "30%" }).then(function (data) {
      console.log("Resize result:", data);
    });
});

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

    loader.style.display = "flex";

    if(module_name === "") {
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
            await ZOHO.CRM.UI.Popup.closeReload().then(console.log);
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