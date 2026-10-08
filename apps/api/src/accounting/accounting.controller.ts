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
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ExpenseStatus } from '@prisma/client';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { AccountingService } from './accounting.service';
import { ExpensesService } from './expenses.service';

// class-validator has no numeric/boolean coercion: tiny Transform helpers
// keep multipart form fields (strings) comparable with JSON bodies.
const ToNumber = () =>
  Transform(({ value }) =>
    value === undefined || value === '' ? undefined : Number(value),
  );
const ToBoolean = () =>
  Transform(({ value }) =>
    typeof value === 'string' ? value === 'true' : Boolean(value),
  );

class RangeQueryDto {
  @IsOptional() @Type(() => Date) @IsDate() from?: Date;
  @IsOptional() @Type(() => Date) @IsDate() to?: Date;
  @IsOptional() @IsString() propertyId?: string;
}

class LedgerQueryDto extends RangeQueryDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) pageSize?: number;
}

class CreateExpenseDto {
  @IsString() @MaxLength(40) category!: string;
  @IsString() @MaxLength(200) label!: string;
  @ToNumber() @IsNumber() @Min(0.01) amount!: number;
  @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @IsOptional() @Type(() => Date) @IsDate() incurredAt?: Date;
  @IsOptional() @IsString() mandateId?: string;
  @IsOptional() @ToBoolean() @IsBoolean() draft?: boolean;
}

class UpdateExpenseDto {
  @IsOptional() @IsString() @MaxLength(40) category?: string;
  @IsOptional() @IsString() @MaxLength(200) label?: string;
  @IsOptional() @ToNumber() @IsNumber() @Min(0.01) amount?: number;
  @IsOptional() @Type(() => Date) @IsDate() incurredAt?: Date;
  @IsOptional() @ToBoolean() @IsBoolean() submit?: boolean;
}

class GenerateStatementDto {
  @IsOptional() @IsString() mandateId?: string;
  @Type(() => Date) @IsDate() periodStart!: Date;
  @Type(() => Date) @IsDate() periodEnd!: Date;
}

class ExpensesQueryDto {
  @IsOptional() @IsEnum(ExpenseStatus) status?: ExpenseStatus;
}

@ApiTags('Accounting')
@ApiBearerAuth()
@Controller()
@UseGuards(AppAuthGuard)
export class AccountingController {
  constructor(
    private readonly accounting: AccountingService,
    private readonly expenses: ExpensesService,
  ) {}

  // ---------------------------------------------------------------- Expenses
  @Post('properties/:id/expenses')
  @ApiOperation({ summary: 'Record an expense on a property (invoice attached)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024 } }),
  )
  createExpense(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateExpenseDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.expenses.createExpense(
      current.userId,
      { ...dto, propertyId: id },
      file
        ? {
            buffer: file.buffer,
            filename: file.originalname,
            mimetype: file.mimetype,
          }
        : undefined,
    );
  }

  @Get('properties/:id/expenses')
  @ApiOperation({ summary: 'List expenses for a property' })
  listExpenses(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Query() query: ExpensesQueryDto,
  ) {
    return this.expenses.listForProperty(current.userId, id, query.status);
  }

  @Patch('expenses/:id')
  @ApiOperation({ summary: 'Modify a DRAFT expense, or submit it' })
  updateExpense(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.expenses.updateExpense(current.userId, id, dto);
  }

  // ----------------------------------------------------------- Owner ledger
  @Get('accounting/owner/summary')
  @ApiOperation({ summary: 'Totals per ledger type for my properties' })
  ownerSummary(
    @CurrentUser() current: AuthenticatedUser,
    @Query() query: RangeQueryDto,
  ) {
    return this.accounting.ownerSummary(current.userId, query);
  }

  @Get('accounting/owner/ledger')
  @ApiOperation({ summary: 'Paginated ledger entries for my properties' })
  ownerLedger(
    @CurrentUser() current: AuthenticatedUser,
    @Query() query: LedgerQueryDto,
  ) {
    return this.accounting.ownerLedger(current.userId, query);
  }

  @Get('accounting/owner/statements')
  @ApiOperation({ summary: 'Stored management statements' })
  listStatements(@CurrentUser() current: AuthenticatedUser) {
    return this.accounting.listStatements(current.userId);
  }

  @Post('accounting/owner/statements')
  @ApiOperation({ summary: 'Generate a management statement for a period' })
  generateStatement(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: GenerateStatementDto,
  ) {
    return this.accounting.generateStatement(current.userId, dto);
  }

  // ----------------------------------------------------------------- Agency
  @Get('accounting/agency/fees')
  @ApiOperation({ summary: 'Agency fee turnover per mandate and period' })
  agencyFees(
    @CurrentUser() current: AuthenticatedUser,
    @Query() query: RangeQueryDto,
  ) {
    return this.accounting.agencyFees(current.userId, query);
  }

  @Get('accounting/export.csv')
  @ApiOperation({ summary: 'CSV export of the ledger' })
  async exportCsv(
    @CurrentUser() current: AuthenticatedUser,
    @Query() query: RangeQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const csv = await this.accounting.exportCsv(current.userId, query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="ledger.csv"');
    return csv;
  }
}
