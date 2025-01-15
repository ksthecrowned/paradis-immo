export const validateForm = (values: any, schema: any) => {
    const errors: Record<string, string> = {};
    for (const field in schema) {
        const rules = schema[field];
        const value = values[field];

        if (rules.required && !value) {
            errors[field] = rules.required;
        } else if (rules.pattern && !rules.pattern.value.test(value)) {
            errors[field] = rules.pattern.message;
        } else if (rules.minLength && value.length < rules.minLength.value) {
            errors[field] = rules.minLength.message;
        } else if (rules.maxLength && value.length > rules.maxLength.value) {
            errors[field] = rules.maxLength.message;
        } else if (rules.isArray && (!Array.isArray(value) || value.length === 0)) {
            errors[field] = rules.isArray.message;
        } else if (rules.isImage && (!value || value === "")) {
            errors[field] = rules.isImage.message;
        } else if (rules.validate) {
            const errorMessage = rules.validate(value, values);
            if (errorMessage) {
                errors[field] = errorMessage;
            }
        }
    }
    return errors;
};

export const toMoneyFormat = (value: number, currency: string) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(value);