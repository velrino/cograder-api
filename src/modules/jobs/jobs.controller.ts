import { Body, Controller, Post, Req } from '@nestjs/common';

@Controller('/apis/jobs')
export class JobsController {
  constructor(private mutateBookingService: MutateBookingService) {}

  @Post()
  async createBooking(
    @Req() req: CustomRequest,
    @Body() body: MutateBookingDto,
  ) {
    return this.mutateBookingService.create(req, body);
  }
}
