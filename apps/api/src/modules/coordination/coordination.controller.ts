import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { CoordinationService, type AcademicFile } from './coordination.service';
import {
  AcademicAssignmentDto,
  AcademicReviewDto,
  DesignationDto,
  MilestoneDto,
  TeacherProcessDto,
  TeacherProfileDto,
  TeacherRequestDto,
} from './coordination.dto';
@Controller('coordination')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('COORDINACION_ACADEMICA_LEER')
export class CoordinationController {
  constructor(private readonly service: CoordinationService) {}
  @Get() workspace(
    @CurrentUser() user: AuthenticatedUser,
    @Query('offerId') offerId?: string,
  ) {
    return this.service.workspace(user, offerId);
  }
  @Post('offers/:id/designation') designation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: DesignationDto,
  ) {
    return this.service.designate(user, id, dto);
  }
  @Patch('teachers/:id/profile') profile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: TeacherProfileDto,
  ) {
    return this.service.profile(user, id, dto);
  }
  @Post('offers/:id/milestones') createMilestone(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: MilestoneDto,
  ) {
    return this.service.milestone(user, id, dto);
  }
  @Patch('milestones/:id') updateMilestone(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: MilestoneDto,
  ) {
    return this.service.updateMilestone(user, id, dto);
  }
  @Post('projects/:id/assignments') assign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AcademicAssignmentDto,
  ) {
    return this.service.assign(user, id, dto);
  }
  @Post('projects/:id/assignments/:teacherId/:typeId/remove')
  removeAssignment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('teacherId') teacherId: string,
    @Param('typeId') typeId: string,
  ) {
    return this.service.removeAssignment(user, id, teacherId, typeId);
  }
  @Post('projects/:id/milestones/:milestoneId/submissions')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024 } }),
  )
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @UploadedFile() file?: AcademicFile,
  ) {
    return this.service.submit(user, id, milestoneId, file);
  }
  @Patch('submissions/:id/review') review(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AcademicReviewDto,
  ) {
    return this.service.review(user, id, dto);
  }
  @Get('submissions/:id/file') submissionFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    return this.service.download(user, id, false, res);
  }
  @Post('offers/:id/teacher-requests') request(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: TeacherRequestDto,
  ) {
    return this.service.request(user, id, dto);
  }
  @Post('teacher-requests/:id/files')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024 } }),
  )
  teacherFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @UploadedFile() file?: AcademicFile,
  ) {
    return this.service.teacherFile(user, id, file);
  }
  @Patch('teacher-files/:id/review') reviewTeacherFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AcademicReviewDto,
  ) {
    return this.service.reviewTeacherFile(user, id, dto);
  }
  @Get('teacher-files/:id/file') downloadTeacherFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    return this.service.download(user, id, true, res);
  }
  @Patch('teacher-requests/:id/process') process(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: TeacherProcessDto,
  ) {
    return this.service.process(user, id, dto);
  }
}
