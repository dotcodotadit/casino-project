import { Router } from 'express'
import { userController } from '../controllers/user.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'

export const userRoutes = Router()

userRoutes.use(requireAuth)
userRoutes.get('/me', userController.getMe)
userRoutes.patch('/me', userController.updateMe)
userRoutes.post('/me/self-exclude', userController.selfExclude)
