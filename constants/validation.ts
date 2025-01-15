export const registrationValidationSchema = {
    name: {
        required: "Ce champ est requis.",
        maxLength: {
            value: 255,
            message: "Le texte doit contenir un maximum de 255 caractères.",
        },
    },
    email: {
        required: "Ce champ est requis.",
        pattern: {
            value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
            message: "L'adresse email n'est pas valide.",
        },
    },
    password: {
        required: "Ce champ est requis.",
        minLength: {
            value: 8,
            message: "Le mot de passe doit contenir au moins 8 caractères.",
        },
        pattern: {
            value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[a-zA-Z\d@$!%*?&]{8,}$/,
            message: "Le mot de passe doit contenir au moins une lettre majuscule, une lettre minuscule, un chiffre et un caractère spécial.",
        },
    },
    confirmPassword: {
        required: "Ce champ est requis.",
        validate: (value: string) => value === "password" || "Les mots de passe ne correspondent pas.",
    },
}