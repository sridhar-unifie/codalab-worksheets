// @flow
import * as React from 'react';
import { withStyles } from '@material-ui/core';
import Button from '@material-ui/core/Button';
import Table from '@material-ui/core/Table';
import TableHead from '@material-ui/core/TableHead';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableRow from '@material-ui/core/TableRow';
import SaveIcon from '@material-ui/icons/Save';
import TextField from '@material-ui/core/TextField';
import ArrowDropDownRoundedIcon from '@material-ui/icons/ArrowDropDownRounded';
import IconButton from '@material-ui/core/IconButton';
import * as Mousetrap from '../../../../util/ws_mousetrap_fork';
import ArrowDropUpIcon from '@material-ui/icons/ArrowDropUp';
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown';
import DeleteSweepIcon from '@material-ui/icons/DeleteSweep';
import AddCircleIcon from '@material-ui/icons/AddCircle';
import RestoreIcon from '@material-ui/icons/Restore';
import classNames from 'classnames';
import ViewListIcon from '@material-ui/icons/ViewList';
import ArrowRightRoundedIcon from '@material-ui/icons/ArrowRightRounded';
import Tooltip from '@material-ui/core/Tooltip';
import HelpOutlineOutlinedIcon from '@material-ui/icons/HelpOutlineOutlined';

class SchemaItem extends React.Component<{
    worksheetUUID: string,
    item: {},
    reloadWorksheet: () => any,
}> {
    constructor(props) {
        super(props);
        this.state = {
            showSchemaDetail: false,
            rows: [...this.props.item.field_rows],
            cur_schema_name: this.props.item.schema_name,
            newAddedRow: -1,
        };
    }

    toggleEdit = (clear, save) => () => {
        if (!this.props.editPermission) return;
        if (clear) {
            this.clearChanges();
            return;
        }
        if (save) {
            this.saveSchema();
        }
    };

    clearChanges = () => {
        this.setState({
            rows: [...this.props.item.field_rows],
            cur_schema_name: this.props.item.schema_name,
            newAddedRow: -1,
        });
    };

    saveSchema = () => {
        const { schema_name, field_rows } = this.props.item;
        let updatedSchema = ['% schema ' + this.state.cur_schema_name];
        let fromAddSchema = false;
        let schemaBlockSourceLength = field_rows.length + 1; // 1 for the schema name row
        this.state.rows.forEach((fields) => {
            if (!fields['field']) {
                return;
            }
            if (!fromAddSchema && fields.from_schema_name !== schema_name) {
                // these rows correspond to addschema
                fromAddSchema = true;
                updatedSchema.push('% addschema ' + fields.from_schema_name);
                return;
            } else if (fromAddSchema && fields.from_schema_name !== schema_name) {
                // These rows doesn't occupy any source lines
                schemaBlockSourceLength -= 1;
                return;
            } else {
                fromAddSchema = false;
            }

            let curRow = '% add ' + fields['field'];
            if (!fields['generalized-path']) {
                updatedSchema.push(curRow);
                return;
            }
            curRow = curRow + ' ' + fields['generalized-path'];
            if (!fields['post-processor']) {
                updatedSchema.push(curRow);
                return;
            }
            curRow = curRow + ' ' + fields['post-processor'];
            updatedSchema.push(curRow);
        });
        this.props.updateSchemaItem(
            updatedSchema,
            this.props.item.start_index,
            schemaBlockSourceLength,
        );
    };

    addFieldRowAfter = (idx) => (e) => {
        if (!this.props.editPermission) return;
        const schemaItem = this.props.item;
        const schemaHeaders = schemaItem.header;
        let newRow = { from_schema_name: schemaItem.schema_name };
        schemaHeaders.forEach((header) => {
            newRow[header] = '';
        });
        let curRow = [...this.state.rows];
        curRow.splice(idx + 1, 0, newRow);
        this.setState({ rows: curRow, newAddedRow: idx + 1 });
    };

    changeFieldValue = (idx, key) => (e) => {
        if (!this.props.editPermission) return;
        const { rows } = this.state;
        let copiedRows = [...rows];
        copiedRows.splice(idx, 1, { ...rows[idx], [key]: e.target.value });
        this.setState({ rows: [...copiedRows] });
    };

    changeSchemaName = (e) => {
        if (!this.props.editPermission) return;
        this.setState({ cur_schema_name: e.target.value });
    };

    moveFieldRow = (idx, direction) => () => {
        if (!this.props.editPermission) return;
        // -1 for moving up, 1 for moving down
        const { rows } = this.state;
        let copiedRows = [...rows];
        let newIndex = idx + direction;
        [copiedRows[newIndex], copiedRows[idx]] = [copiedRows[idx], copiedRows[newIndex]];
        if (copiedRows[idx].from_schema_name !== this.props.item.schema_name) {
            // if the last row we switched with was generated by addschema
            // we should check and keep switching
            // until we meet a non-addschema row or top/end of table
            idx += direction;
            newIndex += direction;
            while (
                newIndex >= 0 &&
                newIndex < rows.length &&
                rows[newIndex].from_schema_name !== this.props.item.schema_name
            ) {
                [copiedRows[newIndex], copiedRows[idx]] = [copiedRows[idx], copiedRows[newIndex]];
                idx += direction;
                newIndex += direction;
            }
        }
        this.setState({ rows: copiedRows });
    };

    removeFieldRow = (idx) => () => {
        if (!this.props.editPermission) return;
        const { rows } = this.state;
        let copiedRows = [...rows];
        copiedRows.splice(idx, 1);
        this.setState({ rows: copiedRows });
    };

    componentDidUpdate(prevProps, prevState) {
        if (
            prevProps.item.field_rows !== this.props.item.field_rows ||
            prevProps.item.schema_name !== this.props.item.schema_name
        ) {
            this.setState({
                rows: [...this.props.item.field_rows],
                cur_schema_name: this.props.item.schema_name,
            });
        }
        if (this.state.newAddedRow !== -1 && this.state.rows.length === prevState.rows.length + 1) {
            document.getElementById('textbox-' + this.state.newAddedRow + '-0').focus();
        }
    }

    render() {
        const { classes, editPermission, focused, item } = this.props;
        const { showSchemaDetail, rows } = this.state;
        const schemaItem = item;
        const schemaHeaders = schemaItem.header;
        const schema_name = schemaItem.schema_name;
        let headerHtml, bodyRowsHtml;
        const explanations = {
            field: 'Name of the field. ',
            'generalized-path':
                "Either a field of bundle's metadata (like uuid, name) or a file path inside the bundle prefixed by / (like '/stdout').\n",
            'post-processor':
                'Optional, a function that transforms the string value result of generalized-path, for example uuid uuid [0:8] will keep the first 8 digits of the uuid. ',
        };
        headerHtml =
            showSchemaDetail &&
            schemaHeaders.map((header, index) => {
                return (
                    <TableCell
                        component='th'
                        key={index}
                        style={{ padding: '5', fontSize: '16px', maxWidth: '100' }}
                    >
                        {header}
                        <Tooltip
                            title={
                                explanations[header] +
                                'Click for more information and examples on schemas'
                            }
                        >
                            <IconButton
                                href='https://codalab-worksheets.readthedocs.io/en/latest/Worksheet-Markdown/#schemas'
                                target='_blank'
                            >
                                <HelpOutlineOutlinedIcon fontSize='small' />
                            </IconButton>
                        </Tooltip>
                    </TableCell>
                );
            });
        if (headerHtml && editPermission) {
            headerHtml.push(
                <TableCell
                    key={headerHtml.length}
                    style={{ padding: '5' }}
                    component='th'
                    scope='row'
                >
                    {
                        <Tooltip title={'Add a new row before the first line'}>
                            <IconButton onClick={this.addFieldRowAfter(-1)}>
                                <AddCircleIcon />
                            </IconButton>
                        </Tooltip>
                    }
                    {
                        <Tooltip title={'Save all changes'}>
                            <IconButton onClick={this.toggleEdit(false, true)}>
                                <SaveIcon />
                            </IconButton>
                        </Tooltip>
                    }
                    {
                        <Tooltip title={'Revert all unsaved changes'}>
                            <IconButton onClick={this.toggleEdit(true, false)}>
                                <RestoreIcon />
                            </IconButton>
                        </Tooltip>
                    }
                </TableCell>,
            );
        }
        bodyRowsHtml =
            showSchemaDetail &&
            rows.map((rowItem, ind) => {
                let rowCells = schemaHeaders.map((headerKey, col) => {
                    return (
                        <TableCell
                            key={col}
                            style={{ padding: '5', borderBottom: 'none' }}
                            component='th'
                            scope='row'
                        >
                            <TextField
                                id={'textbox-' + ind + '-' + col}
                                multiline
                                placeholder={'<none>'}
                                value={rowItem[headerKey] || ''}
                                disabled={
                                    !editPermission || rowItem.from_schema_name !== schema_name
                                }
                                onChange={this.changeFieldValue(ind, headerKey)}
                            />
                        </TableCell>
                    );
                });

                if (!editPermission) {
                } else if (rowItem.from_schema_name === schema_name) {
                    rowCells.push(
                        <TableCell
                            key={rowCells.length}
                            style={{ padding: '5', whiteSpace: 'nowrap' }}
                            component='th'
                            scope='row'
                        >
                            <Tooltip title={'Add a new row after this row'}>
                                <IconButton onClick={this.addFieldRowAfter(ind)}>
                                    <AddCircleIcon />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title={'Delete this row'}>
                                <IconButton onClick={this.removeFieldRow(ind)}>
                                    <DeleteSweepIcon />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title={'Move this row up'}>
                                <IconButton
                                    disabled={ind === 0}
                                    onClick={this.moveFieldRow(ind, -1)}
                                >
                                    <ArrowDropUpIcon />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title={'Move this row down'}>
                                <IconButton
                                    disabled={ind === rows.length - 1}
                                    onClick={this.moveFieldRow(ind, 1)}
                                >
                                    <ArrowDropDownIcon />
                                </IconButton>
                            </Tooltip>
                        </TableCell>,
                    );
                } else {
                    rowCells.push(
                        <TableCell>
                            Generated by another schema: {rowItem.from_schema_name}
                        </TableCell>,
                    );
                }
                return (
                    <TableBody>
                        <TableRow>{rowCells}</TableRow>
                    </TableBody>
                );
            });
        let schemaTable = null;
        if (showSchemaDetail) {
            schemaTable = (
                <Table className={classNames(classes.fullTable)}>
                    <TableHead>
                        <TableRow>{headerHtml}</TableRow>
                    </TableHead>
                    {bodyRowsHtml}
                </Table>
            );
        }
        if (focused) {
            Mousetrap.bind(
                ['enter'],
                (e) => {
                    e.preventDefault();
                    this.setState({ showSchemaDetail: !showSchemaDetail });
                },
                'keydown',
            );
            Mousetrap.bindGlobal(['ctrl+enter'], () => {
                this.saveSchema();
                Mousetrap.unbindGlobal(['ctrl+enter']);
            });
            Mousetrap.bindGlobal(['esc'], () => {
                this.clearChanges();
                Mousetrap.unbindGlobal(['esc']);
            });
        }

        return (
            <div
                onClick={() => {
                    this.props.setFocus(this.props.focusIndex, 0);
                }}
            >
                <Tooltip title={showSchemaDetail ? '' : 'Click to view schema'} placement='right'>
                    <Button
                        color='secondary'
                        variant='outlined'
                        onClick={() => this.setState({ showSchemaDetail: !showSchemaDetail })}
                        style={{ paddingLeft: '10px' }}
                        className={classNames(focused ? classes.highlight : '')}
                    >
                        {showSchemaDetail ? (
                            <ArrowDropDownRoundedIcon />
                        ) : (
                            <ArrowRightRoundedIcon />
                        )}
                        <ViewListIcon style={{ padding: '0px' }} />
                    </Button>
                </Tooltip>
                {
                    <TextField
                        variant='outlined'
                        id='standard-multiline-static'
                        InputProps={{
                            style: {
                                padding: 8,
                            },
                        }}
                        multiline
                        size='small'
                        disabled={!showSchemaDetail}
                        value={this.state.cur_schema_name}
                        style={{ paddingLeft: '20px' }}
                        onChange={this.changeSchemaName}
                    />
                }
                {schemaTable}
            </div>
        );
    }
}

const styles = (theme) => ({
    highlight: {
        backgroundColor: `${theme.color.primary.lightest} !important`,
    },
});

export default withStyles(styles)(SchemaItem);