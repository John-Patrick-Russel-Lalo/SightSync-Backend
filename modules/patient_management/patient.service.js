

export const phoneNumberValidator = async (req, res) => {
  try {
    
    const { phoneNumber } = req.body;

    if (!phoneNumber || phoneNumber.length < 7 || phoneNumber.length > 15) {
      return res.status(400).json({
        success: false,
        message: "Phone number must be at least 7 and at most 15 digits",
      });
    }

    const validPhoneRegex = /^[0-9]{11}$/;

    if (!validPhoneRegex.test(phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number",
      });
    }
    
    
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}


export const updateMyPatientProfileValidator = async (req, res, next) => {
    try {

        const { dateOfBirth, gender, phoneNumber, bloodType, emergencyContactName, emergencyContactPhone, insuranceProvider, insurancePolicyNumber } = req.body;

        if (!dateOfBirth || !gender || !phoneNumber || !bloodType || !emergencyContactName || !emergencyContactPhone || !insuranceProvider || !insurancePolicyNumber) {
            return res.status(400).json({
                success: false,
                message: "All fields are required",
            });
        } else {
            next();
        }
        
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}