import { z } from 'zod';

/**
 * El usuario se normaliza a minúsculas y sin espacios: "Admin " y "admin"
 * son la misma cuenta. La contraseña NO se toca, ni se recorta ni se
 * transforma: un espacio al final es parte de la contraseña.
 */
export const loginSchema = z.object({
  username: z
    .string()
    .min(1, 'el usuario es obligatorio')
    .max(50)
    .transform((valor) => valor.trim().toLowerCase()),
  password: z.string().min(1, 'la contraseña es obligatoria').max(200),
});

export type LoginBody = z.infer<typeof loginSchema>;
